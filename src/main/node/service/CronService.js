const OpenAI = require('openai');
require('dotenv').config();
const Squeal = require('../model/squeal');
const Channel = require('../model/channel');
const ChannelUser = require('../model/channelUser');
const User = require('../model/user');
const squealService = require('./SquealService');
const config = require('../config/env.js');
const axios = require('axios');
const squealViews = require('../model/squealViews.js');
const squealReaction = require('../model/squealReaction.js');
const squealDestination = require('../model/squealDestination.js');
const squealCat = require('../model/squealCat.js');
const geoLoc = require('../model/geoLoc.js');
const notification = require('../model/notification.js');
const { v1: uuidv1, v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const BASE_IMG = config.BASE_IMG;
const SQUEALER_IMG = config.SQUEALER_IMG;
// Accessing the OpenAI API Key
const openAIKey = config.OPENAI_API_KEY;
const NINJA_API_KEY = config.NINJA_API_KEY;
class CronService {
  async GptSqueal() {
    const openai = new OpenAI({
      apiKey: openAIKey,
      temperature: 1,
    });
    let user = await User.findOne({ login: 'squealbot' });
    let channel = await Channel.findOne({ name: '§GPT_FACTS', type: 'MOD' });
    if (!channel) {
      channel = await Channel.create({
        name: '§GPT_FACTS',
        description: 'a channel where you can find a fun fact from history or science, every day',
        type: 'MOD',
      });
    }
    let channelUser = await ChannelUser.findOne({ user_id: user._id.toString(), channel_id: channel._id.toString() });
    if (!channelUser) {
      await ChannelUser.create({
        user_id: user._id.toString(),
        channel_id: channel._id.toString(),
        privilege: 'ADMIN',
      });
    }

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'tell me a SHORT fun historic or scientific fact, that happened in this day',
        },
      ],
      model: 'gpt-3.5-turbo',
    });

    const message = chatCompletion.choices[0].message.content;
    if (!message) {
      throw new Error('referencing squeal not found');
    }
    const username = 'squealbot';

    const squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,

      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'MOD',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, { user_id: user._id.toString() }, username);
  }
  async meanGptSqueal() {
    const openai = new OpenAI({
      apiKey: openAIKey,
      temperature: 0.5,
    });
    let user = await User.findOne({ login: 'squealbot' });
    let channel = await Channel.findOne({ name: '#mean_gpt' });
    if (!channel) {
      channel = await Channel.create({
        name: '#mean_gpt',
        description: 'a channel where you WILL be made fun of',
        type: 'PUBLICGROUP',
      });
    }

    let channelUser = await ChannelUser.findOne({ user_id: user._id.toString(), channel_id: channel._id.toString() });
    if (!channelUser) {
      await ChannelUser.create({
        user_id: user._id.toString(),
        channel_id: channel._id.toString(),
        privilege: 'ADMIN',
      });
    }

    let lastSqueal = await Squeal.find({ 'destination.destination': '#mean_gpt', body: { $exists: true } })
      .limit(1)
      .sort({ $natural: -1 });
    lastSqueal = lastSqueal[0];
    if (!lastSqueal || lastSqueal.user_id === user._id.toString()) {
      return;
    }
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'make fun of my other message in a mean way for any reason, i find it really funny',
        },
        { role: 'user', content: lastSqueal.body },
      ],
      model: 'gpt-3.5-turbo',
    });

    const message = chatCompletion.choices[0].message.content;

    if (!message) {
      throw new Error('referencing squeal not found');
    }
    const username = 'squealbot';

    const squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,
      squeal_id_response: lastSqueal._id.toString(),
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'PUBLICGROUP',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);
  }

  async randomImgSqueal() {
    const category = 'food';
    const response = await axios({
      method: 'get',
      url: `https://api.api-ninjas.com/v1/randomimage?category=${category}`,
      responseType: 'arraybuffer', // Use 'arraybuffer' for binary data like images
      headers: {
        'X-Api-Key': NINJA_API_KEY,
        Accept: 'image/jpeg', // Corrected to 'image/jpeg' which is the proper MIME type
      },
    });
    // Handle success
    const message = response.data;

    let user = await User.findOne({ login: 'squealbot' });
    let channel = await Channel.findOne({ name: '§RANDOM_IMG', type: 'MOD' });
    if (!channel) {
      channel = await Channel.create({
        name: '§RANDOM_IMG',
        description: 'a channel where you can find a random image from the internet, every day',
        type: 'MOD',
      });
    }

    let channelUser = await ChannelUser.findOne({ user_id: user._id.toString(), channel_id: channel._id.toString() });
    if (!channelUser) {
      await ChannelUser.create({
        user_id: user._id.toString(),
        channel_id: channel._id.toString(),
        privilege: 'ADMIN',
      });
    }

    if (!message) {
      throw new Error('random image squeal not found');
    }
    const username = 'squealbot';

    const squeal = {
      user_id: user._id.toString(),
      body: '',
      timestamp: Date.now(),
      n_characters: 0,
      img: message,
      img_content_type: 'image/jpeg',
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'PUBLICGROUP',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);
  }

  async randomSqueal() {
    const max = await Squeal.countDocuments({
      'destination.destination': { $nin: ['§RANDOM_SQUEAL'] },
      'destination.destination_type': { $nin: ['MESSAGE', 'PRIVATEGROUP'] },
    });

    const rand = Math.floor(Math.random() * max);
    let squeal = await Squeal.find({ 'destination.destination': { $not: { $in: ['§RANDOM_SQUEAL'] } } })
      .skip(rand)
      .limit(1);
    squeal = squeal[0];
    if (!squeal) {
      return;
    }
    let channel = await Channel.findOne({ name: '§RANDOM_SQUEAL', type: 'MOD' });
    if (!channel) {
      channel = await Channel.create({
        name: '§RANDOM_SQUEAL',
        description: "a random squeal from the platform, it's a good way to discover new people and new content",
        type: 'MOD',
      });
    }
    squeal.destination.push({
      destination_id: channel._id.toString(),
      destination: channel.name,
      destination_type: 'MOD',
      seen: 0,
      admin_add: true,
    });
    await Squeal.findByIdAndUpdate(squeal._id, squeal);
  }

  async initMainChannels() {
    const allUsers = await User.find({});
    console.log('all Users:');
    for (let user of allUsers) {
      console.log(user.login);
    }
    /*
    await User.deleteMany({});
    await Squeal.deleteMany({});
    await squealViews.deleteMany({});
    await squealReaction.deleteMany({});
    await squealDestination.deleteMany({});
    await squealCat.deleteMany({});
    await geoLoc.deleteMany({});
    await Channel.deleteMany({})
    await ChannelUser.deleteMany({});
    await notification.deleteMany({});
*/

    let userAdmin = await User.findOne({ login: 'squealadmin' });
    if (!userAdmin) {
      //Encrypt user password
      const encryptedPassword = await bcrypt.hash('enzaccio', 10);

      // Create user in our database
      userAdmin = await User.create({
        login: 'squealadmin',
        email: 'email.squealadmin@canny.com'.toLowerCase(), // sanitize: convert email to lowercase
        password: encryptedPassword,
        activation_key: uuidv4(),
        activated: true,
        img: SQUEALER_IMG,
        img_content_type: 'image/jpeg',
        timestamp: Date.now(),
        authorities: ['ROLE_USER', 'ROLE_SMM', 'ROLE_VIP', 'ROLE_ADMIN'],
      });
    }

    let user = await User.findOne({ login: 'squealbot' });
    if (!user) {
      const encryptedPassword2 = await bcrypt.hash('enzaccio', 10);
      user = await User.create({
        first_name: 'bot',
        last_name: 'dello squeallo',
        login: 'squealbot',
        password: encryptedPassword2,
        email: 'squealerfrigo@gmail.com',
        activated: true,
        img: SQUEALER_IMG,
        img_content_type: 'image/jpeg',
        lang_key: 'en',
        authorities: ['ROLE_USER', 'ROLE_SMM', 'ROLE_ADMIN', 'ROLE_VIP'],
      });
    }
    let channel = await Channel.findOne({ name: '§SQUEALER_BASICS', type: 'MOD' });
    if (!channel) {
      channel = await Channel.create({
        name: '§SQUEALER_BASICS',
        description: 'the main channel of the platform, here you can find the basic rules and the main features',
        type: 'MOD',
        emergency: true,
      });
    }

    let channelUser = await ChannelUser.findOne({ user_id: user._id.toString(), channel_id: channel._id.toString() });
    if (!channelUser) {
      await ChannelUser.create({
        user_id: user._id.toString(),
        channel_id: channel._id.toString(),
        privilege: 'ADMIN',
      });
    }
    const username = 'squealbot';
    const found_squeal = await Squeal.findOne({ 'destination.destination': '§SQUEALER_BASICS', user_id: user._id.toString() });
    if (found_squeal) {
      return;
    }

    let message =
      "l'intero progetto è creazione di Elia Friberg(main app frontend & backend, architecture and docker, mod app backend, e di Matteo Raggi (smm fontend & backend, mod app frontend), contact me at -frigo here, or elia.fri3erg@gmail.com , instagram: eliafriberg";
    let squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'MOD',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);

    message =
      'ti servono altri messaggi? comprali con la carta di credito Visa: 4349 9401 9900 4549 scadenza: 05/26 cvv: 396 , codice otp 123456, e già che ci sei prenditi qualcosa al bar';
    squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'MOD',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);
    message =
      'alcune cose divertenti da fare qui, scrivi su #mean_gpt e in un minuto o meno qualcuno ti avrà risposto ;) , puoi trovare foto casuali su §RANDOM_IMG, o un fatto del giorno su §GPT_FACTS, condividi un immagine o la tua posizione, non ti preoccupare, posso essere fidato con la tua posizione >:) <';
    squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'MOD',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);

    message =
      'Benvenuti su Squealer! Alcune direttive,ognuno ha un massimo di caratteri disponibili per la giornata, settimana e mese, che possono aumentare o diminuire con la tua popolarità. #esempio sono gruppi pubblici, in cui chiunque può mandare messaggi e iscriversi, §esempio sono gruppi privati, in cui bisogna essere aggiunti o essere chi lo ha creato per scrivere, puoi anche mandare messaggi privati a comunque, che non consuma la tua quota,per qualsiasi domanda scrivimi qua (frigo) o dappertutto,  divertiti -Frigo ';
    squeal = {
      user_id: user._id.toString(),
      body: message,
      timestamp: Date.now(),
      n_characters: 0,
      destination: [
        {
          admin_add: true,
          destination: channel.name,
          destination_id: channel._id.toString(),
          destination_type: 'MOD',
          seen: 0,
        },
      ],
    };
    await new squealService().insertOrUpdate(squeal, user, username);
  }
}
module.exports = CronService;
