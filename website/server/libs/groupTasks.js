import * as Tasks from '../models/task';
import {model as Groups} from '../models/group';
import {model as Users} from '../models/user/index';

const SHARED_COMPLETION = {
  default: 'recurringCompletion',
  single: 'singleCompletion',
  every: 'allAssignedCompletion',
};

async function _completeOrUncompleteMasterTask (masterTask, completed) {
  masterTask.completed = completed;
  await masterTask.save();
}

async function _updateAssignedUsersTasks (masterTask, groupMemberTask) {
  if (groupMemberTask.type == 'todo') {
    if (groupMemberTask.completed) {
      // The task was done by one person and is removed from others' lists
      await Tasks.Task.deleteMany({
        'group.taskId': groupMemberTask.group.taskId,
        $and: [
          {userId: {$exists: true}},
          {userId: {$ne: groupMemberTask.userId}},
        ],
      }).exec();
    } else {
      // The task was uncompleted by the group member and should be recreated for assignedUsers
      let group = await Groups.findById(masterTask.group.id);
      let userList = [];
      masterTask.group.assignedUsers.forEach(userId => {
        let query = {_id: userId};
        userList.push(query);
      });
      // @REVIEW There has to be a better way to do this
      // async arrow function callback to the find and/or a forEach resulted in Mongoose ParallelSaveErrors
      let assignedUsers = await Users.find({
          $or: userList
        }).exec();
      for (let i=0; i < assignedUsers.length; i++) {
        let promises = [];
        promises.push(group.syncTask(masterTask, assignedUsers[i]));
        promises.push(group.save());
        await Promise.all(promises);
      }
    }
  } else {
    // Complete or uncomplete the task on other users' lists
    await Tasks.Task.find({
      'group.taskId': groupMemberTask.group.taskId,
      $and: [
        {userId: {$exists: true}},
        {userId: {$ne: groupMemberTask.userId}}
      ]},
      function (err, tasks) {
        // @REVIEW How does Habitica handle errors?
        if (err) return;

        tasks.forEach (task => {
          // Ajdust the task's completion to match the groupMemberTask
          // @REVIEW Completed or notDue tasks have no effect at cron
          // This maintain's the user's streak without scoring the task if someone else completed the task
          // If no assignedUser completes the due daily, all users lose their streaks at their cron
          // An alternative is to set the other assignedUsers' tasks to a later startDate
          // Should we break their streaks to encourage competition for the daily?
          task.completed = groupMemberTask.completed;
          task.save();
        });
      });
  }
}

async function _evaluateAllAssignedCompletion (masterTask) {
  let completions;
  if (masterTask.group.approval && masterTask.group.approval.required) {
    completions = await Tasks.Task.count({
      'group.taskId': masterTask._id,
      'group.approval.approved': true,
    }).exec();
    completions++;
  } else {
    completions = await Tasks.Task.count({
      'group.taskId': masterTask._id,
      completed: true,
    }).exec();
  }
  await _completeOrUncompleteMasterTask(masterTask, (completions >= masterTask.group.assignedUsers.length));
}

async function handleSharedCompletion (groupMemberTask) {
  let masterTask = await Tasks.Task.findOne({
    _id: groupMemberTask.group.taskId,
  }).exec();

  if (!masterTask || !masterTask.group || masterTask.type == 'habit') return;

  if (masterTask.group.sharedCompletion === SHARED_COMPLETION.single) {
    await _updateAssignedUsersTasks(masterTask, groupMemberTask);
    await _completeOrUncompleteMasterTask(masterTask, groupMemberTask.completed);
  } else if (masterTask.group.sharedCompletion === SHARED_COMPLETION.every) {
    await _evaluateAllAssignedCompletion(masterTask);
  }
}

export {
  SHARED_COMPLETION,
  handleSharedCompletion,
};
