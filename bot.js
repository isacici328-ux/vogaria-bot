const { Client, GatewayIntentBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ─── Firebase Init ────────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

// ─── Discord Client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ─── Config IDs ───────────────────────────────────────────────────────────────
const GUILD_ID = '1376291184594522112';

const TICKET_CATEGORIES = {
  '1504180637521809603': { type: 'plainte',     label: 'Dépôt de plainte' },
  '1504182555178696805': { type: 'jugement',    label: 'Demande de jugement' },
  '1504212319012393050': { type: 'avocat',      label: 'Demande d\'avocat' },
  '1504181727881330799': { type: 'ppa',         label: 'Demande de PPA' },
  '1504181447131402451': { type: 'aide',        label: 'Aide et question' },
  '1504394305224314981': { type: 'direction',   label: 'Contacter la direction' },
  '1504395508821528706': { type: 'recrutement', label: 'Recrutement' },
};

// Questions posées selon le type de ticket
const QUESTIONS = {
  plainte: [
    { id: 'plaignant_nom',   question: '👤 **Quel est votre nom de personnage ?**' },
    { id: 'defendeur_nom',   question: '⚖️ **Quel est le nom du mis en cause ?**' },
    { id: 'defendeur_discord', question: '🏷️ **Quel est le @Discord ou l\'ID du mis en cause ?** (tape `inconnu` si tu ne sais pas)' },
    { id: 'faits',           question: '📝 **Décrivez les faits en détail :**' },
    { id: 'infractions',     question: '📋 **Quelles infractions souhaitez-vous retenir ?** (ex: Vol à main armée, Coups et blessures)\nTape `je ne sais pas` si tu n\'es pas sûr.' },
    { id: 'preuves',         question: '📸 **Avez-vous des preuves ?** (captures MDT, témoins, vidéos...)\nListez-les ou tapez `aucune`.' },
  ],
  jugement: [
    { id: 'plaignant_nom',   question: '👤 **Quel est votre nom de personnage ?**' },
    { id: 'defendeur_nom',   question: '⚖️ **Nom du défendeur / partie adverse ?**' },
    { id: 'faits',           question: '📝 **Objet de la demande de jugement :**' },
    { id: 'preuves',         question: '📸 **Preuves et éléments à soumettre :**' },
  ],
  avocat: [
    { id: 'plaignant_nom',   question: '👤 **Votre nom de personnage ?**' },
    { id: 'faits',           question: '📝 **Pourquoi avez-vous besoin d\'un avocat ? Décrivez votre situation :**' },
  ],
  ppa: [
    { id: 'plaignant_nom',   question: '👤 **Votre nom de personnage ?**' },
    { id: 'faits',           question: '📝 **Objet de votre demande de PPA :**' },
  ],
  aide: [
    { id: 'plaignant_nom',   question: '👤 **Votre nom de personnage ?**' },
    { id: 'faits',           question: '❓ **Quelle est votre question ou demande ?**' },
  ],
  direction: [
    { id: 'plaignant_nom',   question: '👤 **Votre nom de personnage ?**' },
    { id: 'faits',           question: '📝 **Objet de votre demande à la direction :**' },
  ],
  recrutement: [
    { id: 'plaignant_nom',   question: '👤 **Votre nom de personnage ?**' },
    { id: 'faits',           question: '📝 **Pourquoi souhaitez-vous rejoindre le tribunal ? Présentez-vous :**' },
  ],
};

// ─── State des sessions actives ───────────────────────────────────────────────
// channelId → { type, step, answers, userId, username, ticketId }
const sessions = new Map();

// ─── Compteur de tickets ──────────────────────────────────────────────────────
async function getNextTicketId() {
  const counterRef = db.collection('_meta').doc('ticket_counter');
  const snap = await counterRef.get();
  const current = snap.exists ? snap.data().count : 0;
  const next = current + 1;
  await counterRef.set({ count: next });
  return `TVG-${new Date().getFullYear()}-${String(next).padStart(3, '0')}`;
}

// ─── Créer le dossier dans Firestore ─────────────────────────────────────────
async function createDossier(channelId, ticketInfo, answers) {
  const ticketId = await getNextTicketId();

  const ticket = {
    ticket_id: ticketId,
    type: mapTypeToUI(ticketInfo.type),
    statut: 'ouvert',
    plaignant: {
      nom: answers.plaignant_nom || '—',
      discord_id: ticketInfo.userId || '',
      discord_username: ticketInfo.username || '',
    },
    defendeur: {
      nom: answers.defendeur_nom || '—',
      discord_id: answers.defendeur_discord || '',
    },
    faits: answers.faits || '—',
    infractions: answers.infractions && answers.infractions.toLowerCase() !== 'je ne sais pas'
      ? answers.infractions.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    preuves: answers.preuves && answers.preuves.toLowerCase() !== 'aucune'
      ? answers.preuves.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    juge_assigne: '',
    procureur_assigne: '',
    avocat_defense: '',
    notes: [],
    messages_discord: [],
    deliberation: null,
    verdict: null,
    discord: {
      channel_id: channelId,
      guild_id: GUILD_ID,
      ticket_label: ticketInfo.label,
    },
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    source: 'discord_tickettool',
  };

  const ref = await db.collection('tickets').add(ticket);
  return { ticketId, docId: ref.id };
}

function mapTypeToUI(type) {
  const map = {
    plainte: 'plainte',
    jugement: 'audience',
    avocat: 'instruction',
    ppa: 'instruction',
    aide: 'plainte',
    direction: 'plainte',
    recrutement: 'plainte',
  };
  return map[type] || 'plainte';
}

// ─── Sauvegarder un message Discord dans Firestore ───────────────────────────
async function saveMessage(channelId, msg) {
  // Trouver le ticket par channel_id
  const snap = await db.collection('tickets')
    .where('discord.channel_id', '==', channelId)
    .limit(1)
    .get();

  if (snap.empty) return;

  const ticketDoc = snap.docs[0];
  const messages = ticketDoc.data().messages_discord || [];

  messages.push({
    id: msg.id,
    auteur: msg.author.username,
    auteur_id: msg.author.id,
    contenu: msg.content,
    date: msg.createdAt.toISOString(),
    est_bot: msg.author.bot,
  });

  await ticketDoc.ref.update({
    messages_discord: messages,
    updated_at: FieldValue.serverTimestamp(),
  });
}

// ─── Démarrer le questionnaire ────────────────────────────────────────────────
async function startQuestionnaire(channel, member, ticketInfo) {
  const session = {
    type: ticketInfo.type,
    label: ticketInfo.label,
    step: 0,
    answers: {},
    userId: member.id,
    username: member.user.username,
  };
  sessions.set(channel.id, session);

  const embed = new EmbedBuilder()
    .setColor(0xd4a82a)
    .setTitle('⚖️ Tribunal de Vogaria — Ouverture du dossier')
    .setDescription(`Bonjour **${member.displayName}** !\n\nJe vais vous poser quelques questions pour constituer votre dossier **${ticketInfo.label}**.\n\n*Répondez simplement en écrivant dans ce channel. Prenez le temps de bien détailler.*`)
    .setFooter({ text: 'Tribunal de Vogaria • Système judiciaire' });

  await channel.send({ embeds: [embed] });
  await askQuestion(channel, session);
}

async function askQuestion(channel, session) {
  const questions = QUESTIONS[session.type] || QUESTIONS.aide;
  const q = questions[session.step];
  if (!q) return;

  const embed = new EmbedBuilder()
    .setColor(0x2980b9)
    .setDescription(`**Question ${session.step + 1}/${questions.length}**\n\n${q.question}`)
    .setFooter({ text: 'Tapez votre réponse ci-dessous' });

  await channel.send({ embeds: [embed] });
}

// ─── Finaliser le dossier ────────────────────────────────────────────────────
async function finalizeDossier(channel, session) {
  try {
    const ticketInfo = { type: session.type, label: session.label, userId: session.userId, username: session.username };
    const { ticketId, docId } = await createDossier(channel.id, ticketInfo, session.answers);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Dossier créé avec succès')
      .setDescription(`Votre dossier a été enregistré au **Tribunal de Vogaria**.\n\nUn membre de l'équipe judiciaire prendra en charge votre demande dans les plus brefs délais.`)
      .addFields(
        { name: 'N° de dossier', value: `\`${ticketId}\``, inline: true },
        { name: 'Type', value: session.label, inline: true },
        { name: 'Statut', value: '🟢 Ouvert', inline: true },
      )
      .setFooter({ text: 'Tribunal de Vogaria • Conservez ce numéro de dossier' });

    await channel.send({ embeds: [embed] });

    // Résumé du dossier
    const resumeLines = Object.entries(session.answers).map(([k, v]) => {
      const labels = { plaignant_nom: 'Plaignant', defendeur_nom: 'Défendeur', defendeur_discord: 'Discord défendeur', faits: 'Faits', infractions: 'Infractions', preuves: 'Preuves' };
      return `**${labels[k] || k}:** ${v}`;
    });

    const resumeEmbed = new EmbedBuilder()
      .setColor(0xb5890f)
      .setTitle('📋 Récapitulatif du dossier')
      .setDescription(resumeLines.join('\n\n'))
      .setFooter({ text: `Dossier ${ticketId}` });

    await channel.send({ embeds: [resumeEmbed] });

    // Enregistrer dans la session le docId pour les futurs messages
    session.docId = docId;
    session.ticketId = ticketId;
    session.completed = true;

  } catch (err) {
    console.error('Erreur création dossier:', err);
    await channel.send('❌ Une erreur est survenue lors de la création du dossier. Contactez un administrateur.');
  }
}

// ─── Events Discord ───────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  client.user.setActivity('Tribunal de Vogaria ⚖️', { type: 3 }); // WATCHING
});

// Nouveau channel créé = nouveau ticket TicketTool
client.on('channelCreate', async (channel) => {
  if (channel.type !== ChannelType.GuildText) return;
  if (channel.guildId !== GUILD_ID) return;

  const parentId = channel.parentId;
  if (!parentId || !TICKET_CATEGORIES[parentId]) return;

  const ticketInfo = TICKET_CATEGORIES[parentId];

  // Attendre 3 secondes que TicketTool poste son message d'accueil
  await new Promise(r => setTimeout(r, 3000));

  // Récupérer le créateur du ticket (premier membre non-bot dans le channel)
  let member = null;
  try {
    const perms = channel.permissionOverwrites.cache;
    for (const [id, overwrite] of perms) {
      if (overwrite.type === 1) { // 1 = member
        try {
          member = await channel.guild.members.fetch(id);
          if (!member.user.bot) break;
        } catch {}
      }
    }
  } catch {}

  if (!member) {
    console.log(`Impossible de trouver le créateur du ticket dans #${channel.name}`);
    return;
  }

  await startQuestionnaire(channel, member, ticketInfo);
});

// Message reçu dans un channel de ticket
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (msg.guildId !== GUILD_ID) return;

  const channelId = msg.channelId;
  const parentId = msg.channel.parentId;

  // Vérifier que c'est un channel de ticket
  if (!parentId || !TICKET_CATEGORIES[parentId]) return;

  const session = sessions.get(channelId);

  // ── Mode questionnaire actif ──
  if (session && !session.completed) {
    const questions = QUESTIONS[session.type] || QUESTIONS.aide;
    const q = questions[session.step];

    // Enregistrer la réponse
    session.answers[q.id] = msg.content;
    session.step++;

    if (session.step < questions.length) {
      // Prochaine question
      await askQuestion(msg.channel, session);
    } else {
      // Toutes les questions posées → créer le dossier
      sessions.set(channelId, { ...session, completed: false }); // éviter double trigger
      await finalizeDossier(msg.channel, session);
      sessions.set(channelId, { ...session, completed: true });
    }
    return;
  }

  // ── Questionnaire terminé → sauvegarder les messages ──
  if (session && session.completed) {
    await saveMessage(channelId, msg);
    return;
  }

  // ── Channel sans session (ticket déjà existant au démarrage du bot) ──
  // Sauvegarder quand même le message si un ticket Firestore existe
  await saveMessage(channelId, msg);
});

// Channel supprimé = ticket fermé
client.on('channelDelete', async (channel) => {
  if (channel.guildId !== GUILD_ID) return;
  const parentId = channel.parentId;
  if (!parentId || !TICKET_CATEGORIES[parentId]) return;

  sessions.delete(channel.id);

  // Marquer le ticket comme archivé dans Firestore
  try {
    const snap = await db.collection('tickets')
      .where('discord.channel_id', '==', channel.id)
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        statut: 'archive',
        updated_at: FieldValue.serverTimestamp(),
      });
      console.log(`Ticket ${channel.name} archivé`);
    }
  } catch (err) {
    console.error('Erreur archivage ticket:', err);
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
