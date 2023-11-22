const Squeal = require('../model/squeal');
const SquealDestination = require('../model/squealDestination');
const ChannelUser = require('../model/channelUser');
const Channel = require('../model/channel');
const SquealCat = require('../model/squealCat');
const SquealReaction = require('../model/squealReaction');
const SquealViews = require('../model/squealViews');
const User = require('../model/user');
const { isModuleNamespaceObject } = require('util/types');
const accountService = require('../service/AccountService');

class ChannelUserService {
  async deleteSubscription(user, username, channel_id) {
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unauthorized');
    }
    const deleted = await ChannelUser.deleteOne({ user_id: thisUser._id.toString(), channel_id });
    if (!deleted) {
      throw new Error('error in deletion');
    }
    return deleted;
  }
  
  async addSubscription(user, username, channel_id) {
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unauthorized');
    }
    const channel = Channel.findById(channel_id);
    if (channel.type == 'PRIVATEGROUP' || channel.type == 'MESSAGE') {
      throw new Error('Channel type invalid');
    }
    const created = await ChannelUser.create({ channel_id, user_id: thisUser._id.toString() });
    if (!created) {
      throw new Error('error in creation');
    }
    return created;
  }

  //not tested
  async addSomeoneSubscription(user, username, channel_id, guy_name) {
    const myUser = await User.findOne({ login: username });
    if (!myUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unauthorized');
    }
    const theirUser = await User.findOne({ login: guy_name });
    if (!theirUser) {
      throw new Error('Invalid username');
    }
    const channel = Channel.findById(id);
    if (!channel) {
      throw new Error('Channel not found');
    }
    if (!(await this.canAdd(myUser, theirUser, channel))) {
      throw new Error('request invalid');
    }
    const created = await ChannelUser.create({ user_id: theirUser._id.toString(), channel_id });
    if (!created) {
      throw new Error('error in creation');
    }
    return created;
  }
  //not tested
  async removeSomeoneSubscription(user, username, channel_id, guy_name) {
    const myUser = await User.findOne({ login: username });
    if (!myUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unauthorized');
    }
    const theirUser = await User.findOne({ login: guy_name });
    if (!theirUser) {
      throw new Error('Invalid username');
    }
    const channel = Channel.findById(id);
    if (!channel) {
      throw new Error('Channel not found');
    }
    if (!(await this.canAdd(myUser, theirUser, channel))) {
      throw new Error('request invalid');
    }
    const deleted = await ChannelUser.deleteOne({ user_id: theirUser._id.toString(), channel_id });
    if (!deleted) {
      throw new Error('error in deletion');
    }
    return deleted;
  }

  async getPeopleFollowing(user, myUsername, id) {
    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    const ch = await Channel.findById(id);
    if (!ch || !ch.type) {
      throw new Error('channel not found or without type');
    }
    if (ch.type == 'PRIVATEGROUP') {
      if (!(await ChannelUser.find({ user_id: thisUser._id.toString(), channel_id: id }))) {
        throw new Error('Unauthorized');
      }
    }

    const chUs = await ChannelUser.find({ channel_id: id });
    if (!chUs) {
      throw new Error('subscription not found');
    }
    const chId = [];
    for (const c of chUs) {
      chId.push(c.user_id);
    }
    let ret = [];
    for (const user_id of chId) {
      ret.push(new accountService().hideSensitive(await User.findById(user_id)));
    }
    return ret;
  }

  async canAdd(thisUser, theirUser, channel) {
    const alreadySubbed = await ChannelUser.find({ channel_id: channel._id.toString(), user_id: theirUser._id.toString() });
    if (alreadySubbed) {
      throw new Error('already subscribed');
    }
    if (new accountService().isMod()) {
      return true;
    }
    const subbed = await ChannelUser.find({ channel_id: channel._id.toString(), user_id: thisUser._id.toString() });
    if (channel.type == 'PRIVATEGROUP' && channel.type && subbed) {
      return true;
    }
    return false;
  }

  async checkSubscribed(ch, myUser) {
    const check = await ChannelUser.find({ channel_id: ch._id.toString(), user_id: myUser._id.toString() });
    return check != null;
  }
}

module.exports = ChannelUserService;
