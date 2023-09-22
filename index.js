require('dotenv').config();
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const Keyv = require('keyv');
const moment = require('moment');
const random = require('@cspruit/serendipity').random;

// Presets
const defaultVolume = 0.1; // Percentage of 1
const defaultLength = 30; // In seconds

const client = new Discord.Client();
const store = new Keyv(`mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASS}@localhost:${process.env.MYSQL_PORT}/bladee`);
store.on('error', err => console.error('Keyv connection error:', err));

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});
client.on('message', async message => {
    const botCmd = '!bladee';
    let reply = '';
    if (message.content.startsWith(botCmd)) {
        const command = message.content.substr(botCmd.length).trim();
        if (command) {
            if (command.startsWith('set')) {
                reply = setCommand(command, message.author.id);
            }
            if (command.startsWith('view')) {
                reply = await viewCommand(command, message.author.id);
            }
            if (command.startsWith('help')) {
                reply = helpCommand();
            }
            if (command.startsWith('clear')) {
                reply = clearCommand(message.author.id);
            }
            if (command.startsWith('mute')) {
                reply = muteCommand(command, message.author.id);
            }
        }
        message.reply(reply || randomWhatever());
    }
});
client.on('voiceStateUpdate', async (oldMember, newMember) => {
    const song = await store.get(`${newMember.id}:url`);
    const vol = await store.get(`${newMember.id}:volume`);
    const len = await store.get(`${newMember.id}:length`);
    const mute = await store.get(`${newMember.id}:mute`);
    if (!song) return;
    if (mute) {
        if (new Date(mute) > new Date()) {
            return;
        } else {
            store.delete(`${newMember.id}:mute`);
        }
    }
    if (newMember.voiceChannel !== oldMember.voiceChannel && newMember.voiceChannel) {
        const voiceChannel = newMember.voiceChannel;
        console.log(`${newMember.displayName} has joined ${newMember.voiceChannel.name}.`);
        const connection = await voiceChannel.join();
        const stream = ytdl(song);
        const dispatcher = connection.playStream(stream);
        dispatcher.on('start', () => {
            if (len !== -1) {
                setTimeout(() => {
                    dispatcher.end();
                }, (len || defaultLength) * 1000);
            }
        });
        // Use your indoor voice, Potato.
        dispatcher.setVolume(vol || defaultVolume);
    }
    if (!newMember.voiceChannel) {
        // Check if the last person left the channel
        console.log(`${newMember.displayName} has left ${oldMember.voiceChannel.name}.`);
        if (oldMember.voiceChannel && oldMember.voiceChannel.members.size <= 1) {
            console.log(`Every one else left ${oldMember.voiceChannel.name}. Leaving too.`);
            oldMember.voiceChannel.leave();
        }
    }
});

client.login(process.env.BOT_TOKEN);

function storeSet(id, url, length, volume) {
    if (url) store.set(`${id}:url`, url);
    if (length) store.set(`${id}:length`, length);
    if (volume) store.set(`${id}:volume`, volume);
}

function getRandomSuccess() {
    const successStatements = [
        'This is Elon Musk',
        'Newgbite',
        'Mathcouille',
        'Roll my Dice',
        'GlyveEEEees',
        'Akrapovic',
        'Star du Sex',
        'Abudulu',
        'Sexeur Fou',
        'La Calveillance',
        'Elon Musk CEO'
    ];
    const r = Math.floor(Math.random() * (successStatements.length));
    return successStatements[r];
}

function getRandomFailure() {
    const failureStatements = [
        'Désolé tu sais pas faire des commandes...',
    ];
    const r = random(failureStatements.length);
    return failureStatements[r];
}

function randomWhatever() {
    const whatevergifs = [
        'https://tenor.com/view/monkey-monki-monke-meme-tired-gif-21376611',
    ];
    const r = random(whatevergifs.length);
    return whatevergifs[r];
}

function setCommand(command, id) {
    let url;
    let length;
    let volume;
    let success = [];
    let info;
    let fail;

    // Set URL
    const urlMatch = command.match(/url (.*?)(\s|$)/);
    const lengthMatch = command.match(/(length|len|at) (\w*)%?\s?/);
    const volMatch = command.match(/(volume|vol|girth|for) (\w*)%\s?/);
    if (urlMatch && urlMatch.length && urlMatch[1]) {
        url = urlMatch[1];
    };
    if (lengthMatch && lengthMatch.length && lengthMatch[1]) {
        length = lengthMatch[1];
    }
    if (volMatch && volMatch.length && volMatch[2]) {
        volume = volMatch[2];
    }

    if (!url && !length && !volume) {
        return '';
    }

    if (url) {
        success.push(`to <${url}>`);
        storeSet(id, url);
    }

    if (length) {
        if (Number.parseInt(length)) {
            success.push(`for ${length} seconds`);
            storeSet(id, null, length);
        } else if (length === 'full' || length === 'all') {
            success.push(`for the whole song`);
            storeSet(id, null, -1);
        } else {
            info = `Désolé poto, j'arrive pas à déterminer la durée. Utilise bien "all" ou "full".`;
        }
    }

    if (volume) {
        if (Number.parseInt(volume)) {
            if ((volume > 0 && volume < 101)) {
                success.push(`at ${volume}%`);
                storeSet(id, null, null, (volume / 100));
            } else {
                info = `Désolé, mais je ne peux pas déterminer ce que tu veux comme volume car je suis un simple robot et je ne sais compter que de 1 à 100.`;
            }
        } else {
            info = `Désolé, mais je ne comprends pas ce que vous voulez en termes de volume. Vous devez utiliser un nombre compris entre 0 et 100.`;
        }
        
    }

    // Compose Message
    reply = success.length ? '\n' + getRandomSuccess() + '\n' + `Je prends ton son ` + success.join(' ') + '.' : '';
    reply += fail ? '\n' + getRandomFailure() + '\n' + fail : '';
    reply += info ? '\n' + info : '';

    return reply;
}

async function viewCommand(command, id) {
    const url = await store.get(`${id}:url`);
    const vol = await store.get(`${id}:volume`);
    const len = await store.get(`${id}:length`);
    const mute = await store.get(`${id}:mute`);
    if (!url && !vol && !len && !mute) return `I've got nothing for ya.`;
    let reply = '';
    reply += url ? '\n' + '**Url**: ' + url : '';
    reply += len ? '\n' + '**Length**: ' + len + ' seconds' : '';
    reply += vol ? '\n' + '**Volume**: ' + Math.floor(vol * 100) + '%' : '';
    if (mute) {
        const untilDate = new Date(mute);
        if (untilDate > new Date()) {
            reply += '\n' + '**Mute**: ' + moment(untilDate).format('LTS - l');
        } else {
            store.delete(`${id}:mute`);
        }
    }

    return reply;
}

function helpCommand() {
    let reply = '';
    reply += '\n' + `Salut, je suis le bot du Dev.`;
    reply += '\n' + `Je joue des soundboard quand un mec rejoins.`;
    reply += '\n' + `Pour avoir mon attention il faut faire !salad et entrer la commande`;
    reply += '\n' + '**help**: Je te vois, tu es là.';
    reply += '\n' + '**view**: Voici ce que je possède dans mon registre.';
    reply += '\n' + '**clear**: Je vais éffacer le registre';
    reply += '\n' + '**mute**: Mettre la lecture en pause pour le prochain X (s, m, h, d)';
    reply += '\n' + '**set**: Définissez un URL, le volume et la durée du clip audio que vous souhaitez lire';
    reply += '\n' + 'Example: !bladee set url <https://www.youtube.com/watch?v=dQw4w9WgXcQ> for 5 at 15%';
    reply += '\n' + `Vous pouvez également omettre la longueur et le volume et les définir par défaut.`;
    reply += '\n' + 'Réglez la longueur sur "full" ou "all" si vous souhaitez lire intégralement un clip.';
    reply += '\n' + `Tu peux aussi me MP, mais fais gaffe Newgy m'a codé...`;

    return reply;
}

function clearCommand(id) {
    store.delete(`${id}:url`);
    store.delete(`${id}:length`);
    store.delete(`${id}:volume`);
    store.delete(`${id}:mute`);

    return `Je me suis éffacé correctement`;
}

function muteCommand(command, id) {
    const timeMatch = command.match(/(\d*)(s|m|h)/);
    // Default to 5 minutes
    let time = 5;
    let timeUnit = 'm';
    let units = 'minutes';
    let ms = 5000;
    let reply;

    if (timeMatch && timeMatch.length && timeMatch[1]) {
        time = timeMatch[1];
        if (timeMatch[2]) {
            timeUnit = timeMatch[2];
        }
    };

    switch(timeUnit) {
        case 's':
        case 'sec':
        case 'seconds':
        case 'second':
            units = 'second(s)';
            ms = time * 1000;
            break;
        case 'm':
        case 'min':
        case 'minutes':
        case 'minute':
            units = 'minute(s)';
            ms = time * 1000 * 60;
            break;
        case 'h':
        case 'hours':
        case 'hour':
            units = 'hour(s)';
            ms = time * 1000 * 60 * 60;
            break;
        case 'd':
        case 'day':
        case 'days':
            units = 'day(s)';
            ms = time * 1000 * 60 * 60 * 24;
            break;
        default:
            units = 'minute(s)';
            ms = time * 1000 * 60;
            break;
    }

    reply = `D'accord, je vais me taire pour ${time} ${units}`;
    const stopPauseAt = new Date().getTime() + ms;
    store.set(`${id}:mute`, stopPauseAt);
    return reply;
}