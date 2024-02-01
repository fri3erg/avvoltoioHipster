const Squeal = require('../model/squeal');
const SquealDestination = require('../model/squealDestination');
const ChannelUser = require('../model/channelUser');
const Channel = require('../model/channel');
const SquealCat = require('../model/squealCat');
const SquealViews = require('../model/squealViews');
const User = require('../model/user');
const AdminExtras = require('../model/adminExtras');
const reactionService = require('../service/ReactionService');
const accountService = require('./AccountService');
const channelUserService = require('./ChannelUserService');
const GeoLoc = require('../model/geoLoc');
const Money = require('../model/money');
const moment = require('moment');
const Notify = require('../model/notification');
const socket = require('../socket');
const config = require('../config/env');

const Jimp = require('jimp');
//params:
//page and size for paging
//user for auth and isUserAuthorized
//username,user to do action on, default: you, but smm
class SquealService {
  async getUserChars(username) {
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) throw new Error('Invalid username');

    const purchased = await AdminExtras.find({ user_id: thisUser._id.toString(), valid_until: { $gte: Date.now() } });
    const ch_purchased = purchased.reduce((acc, p) => acc + p.n_characters, 0);

    const squeals = await Squeal.find({ user_id: thisUser._id.toString(), timestamp: { $gte: Date.now() - config.msinMonth } });
    const ids = squeals
      .filter(s => !s.destination.some(d => ['MOD', 'PRIVATEGROUP', 'PUBLICGROUP'].includes(d.destination_type)))
      .map(s => s._id.toString());

    const cats = await SquealCat.find({ squeal_id: { $in: ids } });
    const ch_total = cats.reduce((acc, c) => acc + c.n_characters, 0);

    let chRemMonth = parseInt(config.chMonth + ch_total + ch_purchased);
    let [chRemWeek, chRemDay] = [chRemMonth, chRemMonth].map(ch =>
      parseInt(ch / (ch === chRemMonth ? config.monthWeekMultiplier : config.weekDayMultiplier))
    );

    squeals.forEach(s => {
      const nChars = s.n_characters;
      chRemMonth -= nChars;
      if (s.timestamp > Date.now() - config.msinWeek) {
        chRemWeek -= nChars;
        if (s.timestamp > Date.now() - config.msinDay) {
          chRemDay -= nChars;
        }
      }
    });

    const extra_admin = await AdminExtras.find({ user_id: thisUser._id.toString() });
    const extra_admin_ch = extra_admin.reduce((acc, e) => acc + e.n_characters, 0);
    [chRemMonth, chRemWeek, chRemDay] = [chRemMonth, chRemWeek, chRemDay].map(ch => ch + extra_admin_ch);

    const remainingChars = Math.min(chRemDay, chRemWeek, chRemMonth);
    const type = remainingChars === chRemDay ? 'DAY' : remainingChars === chRemWeek ? 'WEEK' : 'MONTH';

    return { remainingChars, type };
  }

  async getSquealList(page, size, user, username) {
    const ret = [];
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unauthorized');
    }

    const chUs = await ChannelUser.find({ user_id: thisUser._id.toString() });

    let chId = [];
    for (const us of chUs) {
      chId.push(us.channel_id);
    }
    const chMod = await Channel.find({ emergercy: true });
    for (const c of chMod) {
      chId.push(c._id.toString());
    }

    const sq = await Squeal.find({ 'destination.destination_id': { $in: chId } })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });

    for (const s of sq) {
      s.destination = await this.filterDestinations(s, thisUser);
      if (s.destionation == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, thisUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async getSquealListFiltered(page, size, user, byTimestamp) {
    const ret = [];
    const thisUser = await User.findOne({ login: user.username });
    if (!thisUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isMod(thisUser))) {
      throw new Error('Unauthorized');
    }

    const sq = await Squeal.find({})
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: byTimestamp });

    const dto = await this.loadSquealData(s, thisUser);

    if (dto) {
      ret.push(dto);
    }
    return ret;
  }

  async getSquealListCmt(page, size, user, username) {
    const ret = [];
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Invalid username');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unauthorized');
    }

    const chUs = await ChannelUser.find({ user_id: thisUser._id.toString() });

    let chId = [];
    for (const us of chUs) {
      chId.push(us.channel_id);
    }
    const chMod = await Channel.find({ type: 'MOD' });
    for (const c of chMod) {
      chId.push(c._id.toString());
    }

    const sq = await Squeal.find({ 'destination.destination_id': { $in: chId }, squeal_id_response: null })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });

    for (const s of sq) {
      s.destination = await this.filterDestinations(s, thisUser);
      if (s.destination == []) {
        return null;
      }
      const dto = await this.loadSquealData(s, thisUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async getSquealById(user, username, id) {
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    const s = await Squeal.findById(id);
    s.destination = await this.filterDestinations(s, thisUser);
    if (s.destination == []) {
      return null;
    }
    return await this.loadSquealData(s, thisUser);
  }

  async getSquealsSentByUser(page, size, user, myUsername, theirUsername) {
    const ret = [];
    const theirUser = await User.findOne({ login: theirUsername });
    const myUser = await User.findOne({ login: myUsername });
    if (!theirUser || !myUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unathorized');
    }
    let squealsSent = [];
    let squealsReceived = await Squeal.find({ 'destination.destination_id': myUser._id.toString(), user_id: theirUser._id.toString() })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });
    if (theirUser.login !== myUsername) {
      squealsSent = await Squeal.find({ 'destination.destination_id': theirUser._id.toString(), user_id: myUser._id.toString() })
        .limit(size)
        .skip(size * page)
        .sort({ timestamp: -1 });
    }
    let squeals = squealsReceived.concat(squealsSent);
    for (const s of squeals) {
      s.destination = await this.filterDestinations(s, myUser);
      if (s.destination == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, myUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async filterDestinations(squeal, thisUser) {
    let validDest = [];
    for (const d of squeal.destination) {
      if (await new channelUserService().userHasReadPrivilege(d, thisUser)) {
        validDest.push(d);
      }
    }
    return validDest;
  }

  async getSquealMadeByUser(page, size, user, myUsername, theirUsername) {
    const ret = [];
    const theirUser = await User.findOne({ login: theirUsername });
    const myUser = await User.findOne({ login: myUsername });
    if (!theirUser || !myUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unathorized');
    }
    const chTypes = ['MOD', 'PUBLICGROUP'];
    const squeals = await Squeal.find({ user_id: theirUser._id.toString(), 'destination.destination_type': { $in: chTypes } })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });

    for (const s of squeals) {
      s.destination = await this.filterDestinations(s, myUser);
      if (s.destination == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, myUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async getSquealMadeByUserCmt(page, size, user, myUsername, theirUsername) {
    const ret = [];
    const theirUser = await User.findOne({ login: theirUsername });
    const myUser = await User.findOne({ login: myUsername });
    if (!theirUser || !myUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unathorized');
    }
    const chTypes = ['MOD', 'PUBLICGROUP'];
    const squeals = await Squeal.find({
      user_id: theirUser._id.toString(),
      'destination.destination_type': { $in: chTypes },
      squeal_id_response: null,
    })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });

    for (const s of squeals) {
      s.destination = await this.filterDestinations(s, myUser);
      if (s.destination == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, myUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async countSquealMadeByUser(user, myUsername, theirUsername) {
    const theirUser = await User.findOne({ login: theirUsername });
    const myUser = await User.findOne({ login: myUsername });
    if (!theirUser || !myUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unathorized');
    }
    return await Squeal.countDocuments({ user_id: theirUser._id.toString(), squeal_id_response: null });
  }

  async getSquealByChannel(page, size, user, myUsername, id) {
    const ret = [];
    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    const squeals = await Squeal.find({ 'destination.destination_id': id })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });
    for (const s of squeals) {
      s.destination = await this.filterDestinations(s, thisUser);
      if (s.destination == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, thisUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async getSquealByChannelCmt(page, size, user, myUsername, id) {
    const ret = [];
    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    const squeals = await Squeal.find({ 'destination.destination_id': id, squeal_id_response: null })
      .limit(size)
      .skip(size * page)
      .sort({ timestamp: -1 });
    for (const s of squeals) {
      s.destination = await this.filterDestinations(s, thisUser);
      if (s.destination == []) {
        continue;
      }
      const dto = await this.loadSquealData(s, thisUser);

      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async countSquealMadeByUser(user, myUsername, theirUsername) {
    const theirUser = await User.findOne({ login: theirUsername });
    const myUser = await User.findOne({ login: myUsername });
    if (!theirUser || !myUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, myUser))) {
      throw new Error('Unathorized');
    }
    const chTypes = ['MOD', 'PUBLICGROUP'];
    return await Squeal.countDocuments({ user_id: theirUser._id.toString(), 'destination.destination_type': { $in: chTypes } });
  }

  async getGeoLoc(id, user, myUsername) {
    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    const geoLoc = await GeoLoc.findOne({ squeal_id: id });
    const squeal = await Squeal.findById(id);
    if (!(await new channelUserService().userHasReadPrivilege(squeal, thisUser))) {
      throw new Error('Unauthorized');
    }
    return geoLoc;
  }
  async updateGeoLoc(geoLoc, user, myUsername) {
    if (this.geoLocIsInvalid(geoLoc)) {
      throw new Error('GeoLoc invalid');
    }
    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }
    if (!this.checkGeoMine(geoLoc, thisUser)) {
      throw new Error('Unauthorized');
    }

    if (geoLoc.timestamp < Date.now() - (3600000 - 10000)) {
      geoLoc.refresh = false;
    }
    const loc = await GeoLoc.findByIdAndUpdate(geoLoc._id.toString(), {
      latitude: geoLoc.latitude,
      longitude: geoLoc.longitude,
      accuracy: geoLoc.accuracy,
      speed: geoLoc.speed,
      heading: geoLoc.heading,
      timestamp: Date.now(),
      refresh: geoLoc.refresh,
    });
    if (!loc) {
      throw new Error('could not add geoloc');
    }
    return loc;
  }

  geoLocIsInvalid(geoLoc) {
    if (!geoLoc.latitude || !geoLoc.longitude || !geoLoc._id.toString() || !geoLoc.squeal_id) {
      return true;
    }
    return false;
  }

  checkGeoMine(geoLoc, thisUser) {
    return geoLoc.user_id === thisUser._id.toString();
  }

  async getDirectSquealPreview(user, myUsername) {
    const ret = [];

    const thisUser = await User.findOne({ login: myUsername });
    if (!thisUser) {
      throw new Error('Username Invalid');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unathorized');
    }

    let squeals = await Squeal.find({ 'destination.destination_id': thisUser._id.toString() });
    let squealsSent = await Squeal.find({
      user_id: thisUser._id.toString(),
      'destination.destination_id': { $regex: '(?i)' + '@' + '.*' },
    });
    squeals = squeals.concat(squealsSent);
    const map = new Map();
    for (const s of squeals) {
      const user = s.user_id;
      let n = s;
      map.set(user, n);
    }

    squeals = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async insertOrUpdate(squeal, user, username, geoLoc) {
    let ret = {};
    const thisUser = await User.findOne({ login: username });
    if (!squeal || !thisUser) {
      throw new Error('Invalid data');
    }
    if (!(await new accountService().isUserAuthorized(user, thisUser))) {
      throw new Error('Unauthorized');
    }

    if (squeal.squeal_id_response) {
      let valid = false;
      const referencing_squeal = await Squeal.findById(squeal.squeal_id_response);

      if (!referencing_squeal) {
        throw new Error('referencing squeal not found');
      }
      for (const dest of referencing_squeal.destination) {
        if ((await new channelUserService().userHasReadPrivilege(dest, thisUser)) || squeal.squeal_id_response) {
          valid = true;
        }
      }
      if (!valid) {
        throw new Error('Unauthorized');
      }
    }

    let newSqueal = new Squeal({
      user_id: thisUser._id.toString(),
      timestamp: Date.now(),
      body: squeal.body,
      img: await this.resizeSquealImg(squeal.img),
      img_content_type: squeal.img_content_type,
      img_name: squeal.img_name,
      video_content_type: squeal.video_content_type,
      video_name: squeal.video_name,
      n_characters: this.getNCharacters(squeal, geoLoc) ?? 0,
      destination: [],
      squeal_id_response: squeal.squeal_id_response,
    });
    for (const dest of squeal.destination) {
      if (squeal.squeal_id_response || (await new channelUserService().userHasWritePrivilege(dest, thisUser))) {
        //!
        newSqueal.destination.seen = false;
        newSqueal.destination.push(dest);
      }
    }

    if (newSqueal.destination.length == 0) {
      throw new Error('no valid destinations');
    }
    newSqueal = await newSqueal.save();

    await SquealViews.create({
      squeal_id: newSqueal._id.toString(),
      number: 1,
    });

    if (geoLoc) {
      await GeoLoc.create({
        squeal_id: newSqueal._id.toString(),
        user_id: thisUser._id.toString(),
        latitude: geoLoc.latitude,
        longitude: geoLoc.longitude,
        accuracy: geoLoc.accuracy,
        heading: geoLoc.heading,
        speed: geoLoc.speed,
        timestamp: newSqueal.timestamp,
        refresh: geoLoc.refresh,
      });
    }
    const dto = await this.loadSquealData(newSqueal, thisUser);

    if (dto) {
      ret = newSqueal;
    }

    if (squeal.squeal_id_response) {
      const referencing_squeal = await Squeal.findById(squeal.squeal_id_response);

      const m1 = new Notify({
        username: thisUser.login,
        body: squeal.body,
        profile_img: dto.userImg,
        profile_img_content_type: dto.userContentType,
        destId: referencing_squeal.user_id,
        timestamp: Date.now(),
        type: 'COMMENT',
        isRead: false,
      });
      socket.sendNotification(m1);
    }

    for (const dest of newSqueal.destination) {
      const user = socket.getUser(dest.destination_id);
      if (user) {
        const m2 = new Notify({
          username: thisUser.login,
          body: newSqueal.body,
          profile_img: dto.userImg,
          profile_img_content_type: dto.userContentType,
          destId: dest.destination_id,
          timestamp: Date.now(),
          type: 'MESSAGE',
          isRead: false,
        });

        socket.sendNotification(m2);
      }
    }
    return ret;
  }

  async editSqueal(squeal, user, geoLoc) {
    const thisUser = await User.findOne({ login: user.username });
    if (!thisUser) {
      throw new Error('invalid user');
    }
    if (!(await new accountService().isMod(thisUser))) {
      throw new Error('Unathorized');
    }
    if (!squeal || !squeal._id) {
      throw new Error('invalid squeal');
    }
    const squeal_updated = await Squeal.updateOne(
      { _id: squeal._id },
      {
        body: squeal.body,
        img: squeal.img,
        img_content_type: squeal.img_content_type,
        img_name: squeal.img_name,
        video_content_type: squeal.video_content_type,
        video_name: squeal.video_name,
        n_characters: this.getNCharacters(squeal, geoLoc) ?? 0,
        destination: squeal.destination,
        squeal_id_response: squeal.squeal_id_response,
      }
    );

    if (geoLoc) {
      const geoloc_updated = await GeoLoc.updateOne(
        { squeal_id: squeal._id.toString() },
        {
          latitude: geoLoc.latitude,
          longitude: geoLoc.longitude,
          accuracy: geoLoc.accuracy,
          speed: geoLoc.speed,
          heading: geoLoc.heading,
          timestamp: Date.now(),
          refresh: geoLoc.refresh,
        }
      );
    }

    return squeal_updated;
  }

  async getSquealDTO(squeal, username) {
    const thisUser = await User.findOne({ login: username });
    const dto = await this.loadSquealData(squeal, thisUser);
    return dto;
  }

  async getSquealDestination(myUser, username, search) {
    let validDest = [];
    const thisUser = await User.findOne({ login: username });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!(await new accountService().isUserAuthorized(myUser, thisUser))) {
      throw new Error('Unauthorized');
    }
    //reduce search based on type info if present
    if (!search.startsWith('§') && !search.startsWith('#')) {
      const userDest = await new accountService().searchUser(search);
      for (const us of userDest) {
        const dest = new SquealDestination({
          destination_id: us._id.toString(),
          destination: us.login ?? '',
          destination_type: 'MESSAGE',
        });
        validDest.push(dest);
      }
    }
    if (!search.startsWith('#') && !search.startsWith('@')) {
      const ChannelDest = await this.searchChannel('§', search);

      for (const ch of ChannelDest) {
        const dest = new SquealDestination({
          destination_id: ch._id.toString(),
          destination: ch.name ?? '',
          destination_type: ch.type,
        });
        if (await new channelUserService().userHasWritePrivilege(dest, thisUser)) {
          validDest.push(dest);
        }
      }
    }
    if (!search.startsWith('§') && !search.startsWith('@')) {
      const publicFind = await this.searchChannel('#', search);
      for (const ch of publicFind) {
        const dest = new SquealDestination({
          destination_id: ch._id.toString(),
          destination: ch.name ?? '',
          destination_type: 'PUBLICGROUP',
        });
        validDest.push(dest);
      }
      if (search.startsWith('#')) {
        validDest.push({
          destination: search,
          destination_type: 'PUBLICGROUP',
        });
      }
    }
    return validDest;
  }

  async getSquealComments(myUser, theirUsername, squeal_id) {
    const ret = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }
    const squeals = await Squeal.find({ squeal_id_response: squeal_id });
    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto) {
        ret.push(dto);
      }
    }
    return ret;
  }

  async getSquealRankByReaction(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.reaction_number - a.reaction_number);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByReactionInverse(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => a.reaction_number - b.reaction_number);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByComments(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.comments_number - a.comments_number);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByCommentsInverse(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => a.comments_number - b.comments_number);
    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByViews(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.views.number - a.views.number);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByViewsInverse(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => a.views.number - b.views.number);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByPositive(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.positive - a.positive);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByNegative(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.negative - a.negative);

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByPosNegRateo(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => b.positive - b.negative - (a.positive - a.negative));

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealRankByPosNegRateoInverse(page, size, myUser, theirUsername) {
    let squealRank = [];
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() });

    for (const s of squeals) {
      const dto = await this.loadSquealData(s, thisUser);
      if (dto && s.squeal_id_response == null) {
        squealRank.push(dto);
      }
    }
    squealRank.sort((a, b) => a.positive - a.negative - (b.positive - b.negative));

    return squealRank.slice((page - 1) * size, page * size);
  }

  async getSquealTimeChart(myUser, theirUsername, days) {
    let userDataset = [];
    let num = 1;
    let prevTimestamp = new Date();
    var firstDate = true;
    const thisUser = await User.findOne({ login: theirUsername });
    if (!thisUser) {
      throw new Error('Invalid Username');
    }
    if (!new accountService().isUserAuthorized(myUser, thisUser)) {
      throw new Error('Unathorized');
    }

    const squeals = await Squeal.find({ user_id: thisUser._id.toString() }).sort({ timestamp: 1 });

    const dates = [];

    for (let i = 0; i < days; i++) {
      let date = moment();
      date.subtract(i, 'day').format('DD-MM-YYYY');
      dates.push(date.toDate().toLocaleDateString('it-IT'));
    }

    for (const s of squeals) {
      var timestamp = new Date(s.timestamp);
      if (!firstDate) {
        if (timestamp.toLocaleDateString('it-IT') === prevTimestamp.toLocaleDateString('it-IT')) {
          num++;
        } else {
          userDataset.push({
            x: prevTimestamp.toLocaleDateString('it-IT'),
            y: num,
          });
          num = 1;
        }
      } else {
        firstDate = false;
      }
      prevTimestamp = timestamp;
    }
    userDataset.push({
      x: prevTimestamp.toLocaleDateString('it-IT'),
      y: num,
    });

    var found = false;
    for (const date of dates) {
      for (const post of userDataset) {
        if (post.x == date) {
          found = true;
        }
      }
      if (found) {
        found = false;
      } else {
        userDataset.push({
          x: date,
          y: 0,
        });
      }
    }

    function parseDMY(s) {
      var b = s.split(/\D+/);
      return new Date(b[2], b[1] - 1, b[0]);
    }

    userDataset.sort((a, b) => parseDMY(a.x) - parseDMY(b.x));

    return userDataset.slice(-days);
  }

  async searchChannel(prefix, search) {
    if (search.startsWith('§') || search.startsWith('@')) {
      search = search.substring(1);
    }
    return await Channel.find({ name: { $regex: prefix + '(?i).*' + search + '.*' } });
  }

  /*
    async calcCharsChangedWithPopularity(user, myUsername) {
      const ret = [];
      const thisUser = await User.findOne({ login: myUsername });
      if (!thisUser) {
        throw new Error('Username Invalid');
      }
      if (!(await new accountService().isUserAuthorized(user, thisUser))) {
        throw new Error('Unathorized');
      }
  
      let squeals = await Squeal.find({ user_id: thisUser._id.toString(), timestamp: { $gte: Date.now() - config.msinMonth } });
      let squealsSent = await Squeal.find({
        user_id: thisUser._id.toString(),
        'destination.destination_id': { $regex: '(?i)' + '@' + '.*' },
      });
      squeals = squeals.concat(squealsSent);
      const map = new Map();
      for (const s of squeals) {
        const user = s.user_id;
        let n = s;
        map.set(user, n);
      }
  
      squeals = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  
      for (const s of squeals) {
        const dto = await this.loadSquealData(s, thisUser);
        if (dto) {
          ret.push(dto);
        }
      }
      return ret;
    }
    async calcCharsChangedbySqueal(squeal) {
      const ret = [];
  
      const thisUser = await User.findOne({ login: myUsername });
      if (!thisUser) {
        throw new Error('Username Invalid');
      }
      if (!(await new accountService().isUserAuthorized(user, thisUser))) {
        throw new Error('Unathorized');
      }
  
      let squeals = await Squeal.find({ 'destination.destination_id': thisUser._id.toString() });
      let squealsSent = await Squeal.find({
        user_id: thisUser._id.toString(),
        'destination.destination_id': { $regex: '(?i)' + '@' + '.*' },
      });
      squeals = squeals.concat(squealsSent);
      const map = new Map();
      for (const s of squeals) {
        const user = s.user_id;
        let n = s;
        map.set(user, n);
      }
  
      squeals = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  
      for (const s of squeals) {
        const dto = await this.loadSquealData(s, thisUser);
        if (dto) {
          ret.push(dto);
        }
      }
      return ret;
    }
    */

  async getCommentsNumber(squeal_id) {
    const comments = await Squeal.find({
      squeal_id_response: squeal_id,
    });
    return comments.length;
  }

  async loadSquealData(squeal, thisUser) {
    if (!squeal) {
      throw new Error('Nothing to Load');
    }
    const squeal_user = await User.findById({ _id: squeal.user_id });
    if (!squeal_user) {
      throw new Error('User not found');
    }
    if (squeal.user_id != thisUser._id.toString()) {
      await SquealViews.updateOne({ squeal_id: squeal._id.toString() }, { $inc: { number: 1 } });
    }

    const squeal_id = squeal._id.toString();

    const category = await SquealCat.findOne({ squeal_id });

    const userImg = await new accountService().getUserImg(squeal_user._id.toString());

    const userContentType = await new accountService().getUserImgContentType(squeal_user._id.toString());

    const reactions = await new reactionService().getReaction(squeal_id);

    const reaction_number = await new reactionService().getReactionNumber(squeal_id);

    const positive = await new reactionService().getPositiveReactionNumber(squeal_id);

    const negative = await new reactionService().getNegativeReactionNumber(squeal_id);

    const active_reaction = await new reactionService().getActiveReaction(thisUser._id.toString(), squeal_id);

    const comments_number = await this.getCommentsNumber(squeal_id);

    const views = await SquealViews.findOne({ squeal_id });

    const geoLoc = await GeoLoc.findOne({ squeal_id });

    const ret = {
      userName: squeal_user.login,
      squeal,
      category,
      reactions,
      active_reaction,
      reaction_number,
      positive,
      negative,
      comments_number,
      views,
      geoLoc,
      userImg,
      userContentType,
    };
    return ret;
  }

  async resizeSquealImg(img) {
    if (!img) {
      return;
    }

    // Load the image from a base64 string
    const image = await Jimp.read(Buffer.from(img, 'base64'));

    // Resize the image
    image.resize(1280, Jimp.AUTO);

    // Lower the quality for compression
    // Note: Jimp's quality function works a bit differently, it's a scale from 0 to 100
    image.quality(80);

    // Get the buffer of the processed image in JPEG format
    const compressedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

    const compressedBase64 = compressedImageBuffer.toString('base64');
    return compressedBase64;
  }

  getNCharacters(squeal, geoLoc) {
    if (!squeal) {
      throw new Error('squeal not found');
    }
    let n = 0;
    if (squeal.body) {
      n = squeal.body.length;
    }
    if (squeal.img && squeal.img != '') {
      n = n + config.IMGCHAR;
    }
    if (geoLoc) {
      n = n + config.GEOCHAR;
    }

    return n;
  }
}

module.exports = SquealService;
