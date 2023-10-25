const { Schema, model, ObjectId } = require('mongoose');

const PrivilegeType = {
  ADMIN: 'ADMIN',
  WRITE: 'WRITE',
  READ: 'READ',
};

const channelUserSchema = new Schema(
  {
    user_id: { type: String },
    channel_id: { type: String },
    privilege: { type: PrivilegeType, default: null },
  },
  { collection: 'channel_user', _id: true }
);
module.exports = model('channelUser', channelUserSchema);
