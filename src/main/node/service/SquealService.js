const Squeal = require('../model/squeal');
const squealDestination = require('../model/squealDestination');
const channelUser = require('../model/channelUser');
const squealCat = require('../model/squealCat');
const squealReaction = require('../model/squealReaction');
const squealViews = require('../model/squealViews');

class ReactionDTO {
  n_characters;
  number = 0;
  reaction = '';
  constructor(emoji) {
    this.reaction = emoji;
  }
  add() {
    number++;
  }
}
class SquealService {
  async getSquealList(page, size, user) {
    const id = user.user_id;

    const chUs = await channelUser.find({ user_id: id });

    let chId = [];
    for (const us of chUs) {
      chId.push(us.channel_id.toString());
    }

    const sq = await Squeal.find({ 'destination.destination_id': { $in: chId } }).sort({ timestamp: -1 });
    console.log('test');
    console.log(sq);
    const ret = [];
    for (const s of sq) {
      const dto = await this.loadSquealData(s, user);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }
  async loadSquealData(squeal, user) {
    if (squeal == null) {
      return null;
    }
    const id = squeal._id.toString();

    const cat = await squealCat.find({ squeal_id: id });

    const reactions = await this.getReaction(id);

    const views = await squealViews.findOne({ squeal_id: id });

    const ret = {
      userName: user.username,
      squeal: squeal,
      category: cat,
      reactions: reactions,
      views: views,
    };
    return ret;
  }
  async getReaction(id) {
    const reactions = await squealReaction.find({ squeal_id: id });

    const map = new Map();
    for (const reaction of reactions) {
      const emoji = reaction.emoji;
      let r = map.get(emoji);
      if (r == null) {
        r = new ReactionDTO(emoji);
        map.set(emoji, r);
      }
      r.number++;
    }

    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }
}
module.exports = SquealService;
