require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require('discord.js');

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue }     = require('firebase-admin/firestore');

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════════════════════════════════════════════
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG IDs
// ═══════════════════════════════════════════════════════════════════════════════
const GUILD_ID         = '1376291184594522112';
const PANEL_CHANNEL_ID = '1389959434783953068';
const ROLE_STAFF_ID    = '1508403429989421096';

const CATEGORIES = {
  plainte_police:  '1504180637521809603',
  plainte_civil:   '1504180637521809603',
  jugement:        '1504182555178696805',
  avocat:          '1504212319012393050',
  ppa:             '1504181727881330799',
  aide:            '1504181447131402451',
  direction:       '1504394305224314981',
  recrutement:     '1504395508821528706',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE TICKETS
// ═══════════════════════════════════════════════════════════════════════════════
const TICKET_TYPES = {
  plainte_police: { label: 'Plainte contre un policier', emoji: '🚔', color: 0xc0392b },
  plainte_civil:  { label: 'Plainte contre un civil',    emoji: '👤', color: 0xe67e22 },
  jugement:       { label: 'Demande de jugement',        emoji: '⚖️', color: 0xd4a82a },
  avocat:         { label: 'Rendez-vous avocat',         emoji: '🧑‍⚖️', color: 0x2980b9 },
  ppa:            { label: 'Demande de PPA',             emoji: '📄', color: 0x7f8c8d },
  aide:           { label: 'Aide & Question',            emoji: '❓', color: 0x27ae60 },
  direction:      { label: 'Contacter la direction',     emoji: '👑', color: 0x8e44ad },
  recrutement:    { label: 'Recrutement',                emoji: '📋', color: 0x16a085 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAIRES
// ═══════════════════════════════════════════════════════════════════════════════
const FORMS = {
  plainte_police: [
    { id: 'plaignant_nom',  label: '👤 Votre nom de personnage',            placeholder: 'Prénom Nom' },
    { id: 'accusé_nom',     label: '🚔 Nom(s) du/des policier(s) en cause', placeholder: 'Noms des agents impliqués' },
    { id: 'accusé_grade',   label: '🎖️ Grade(s) des policiers',             placeholder: 'Ex: Inspecteur, Capitaine...' },
    { id: 'date_lieu',      label: '📅 Date, heure et lieu de l\'incident', placeholder: 'Ex: 23/05/2026 à 21h00 — Zone Nord' },
    { id: 'faits',          label: '📝 Description détaillée des faits',    placeholder: 'Décrivez précisément ce qui s\'est passé...' },
    { id: 'comportement',   label: '⚠️ Type de comportement reproché',      placeholder: 'Ex: Usage excessif de la force...' },
    { id: 'preuves',        label: '📸 Preuves disponibles',                placeholder: 'Captures MDT, témoins, vidéos... ou "aucune"' },
    { id: 'demandes',       label: '📌 Ce que vous demandez au tribunal',   placeholder: 'Ex: Enquête interne, Réparation...' },
  ],
  plainte_civil: [
    { id: 'plaignant_nom',     label: '👤 Votre nom de personnage',            placeholder: 'Prénom Nom' },
    { id: 'defendeur_nom',     label: '⚖️ Nom de la personne mise en cause',   placeholder: 'Prénom Nom (ou "inconnu")' },
    { id: 'defendeur_discord', label: '🏷️ @Discord du mis en cause',           placeholder: '@pseudo ou ID Discord (ou "inconnu")' },
    { id: 'date_lieu',         label: '📅 Date, heure et lieu de l\'incident', placeholder: 'Ex: 23/05/2026 à 20h30 — Centre-ville' },
    { id: 'faits',             label: '📝 Description détaillée des faits',    placeholder: 'Décrivez précisément ce qui s\'est passé...' },
    { id: 'infractions',       label: '📋 Infractions souhaitées',             placeholder: 'Ex: Vol à main armée... ou "je ne sais pas"' },
    { id: 'preuves',           label: '📸 Preuves disponibles',                placeholder: 'Captures MDT, témoins, vidéos... ou "aucune"' },
    { id: 'demandes',          label: '📌 Ce que vous demandez au tribunal',   placeholder: 'Ex: Condamnation, Réparation...' },
  ],
  jugement: [
    { id: 'plaignant_nom',  label: '👤 Votre nom (demandeur)',             placeholder: 'Prénom Nom' },
    { id: 'defendeur_nom',  label: '⚖️ Nom du défendeur / partie adverse', placeholder: 'Prénom Nom' },
    { id: 'nature_litige',  label: '📂 Nature du litige',                  placeholder: 'Ex: Pénal, Civil, Administratif...' },
    { id: 'date_lieu',      label: '📅 Date et lieu des faits',            placeholder: 'Ex: 23/05/2026 — Zone industrielle' },
    { id: 'faits',          label: '📝 Exposé des faits',                  placeholder: 'Décrivez la situation...' },
    { id: 'preuves',        label: '📸 Preuves et éléments à soumettre',   placeholder: 'Listez vos preuves, témoins, documents...' },
    { id: 'demandes',       label: '📌 Ce que vous demandez au tribunal',  placeholder: 'Ex: Condamnation, Réparation...' },
  ],
  avocat: [
    { id: 'plaignant_nom',    label: '👤 Votre nom de personnage',               placeholder: 'Prénom Nom' },
    { id: 'situation',        label: '⚖️ Votre situation actuelle',               placeholder: 'Ex: Accusé, Mis en cause, Plaignant, En GAV...' },
    { id: 'nature_affaire',   label: '📂 Nature de l\'affaire',                  placeholder: 'Ex: Pénal, Civil — Crime / Délit...' },
    { id: 'faits',            label: '📝 Décrivez votre situation',              placeholder: 'Expliquez pourquoi vous avez besoin d\'un avocat...' },
    { id: 'dossier_existant', label: '📋 N° de dossier existant (si applicable)', placeholder: 'Ex: TVG-2026-042 ou "aucun"' },
    { id: 'urgence',          label: '🚨 Niveau d\'urgence',                     placeholder: 'Ex: Urgente (audience demain) / Normale' },
  ],
  ppa: [
    { id: 'plaignant_nom', label: '👤 Votre nom de personnage',  placeholder: 'Prénom Nom' },
    { id: 'situation',     label: '📝 Votre situation actuelle', placeholder: 'Décrivez brièvement votre situation...' },
    { id: 'motif',         label: '📋 Motif de la demande',      placeholder: 'Ex: Trauma suite à incident...' },
    { id: 'urgence',       label: '🚨 Urgence',                  placeholder: 'Urgente / Normale' },
  ],
  aide: [
    { id: 'plaignant_nom', label: '👤 Votre nom de personnage',   placeholder: 'Prénom Nom' },
    { id: 'faits',         label: '❓ Votre question ou demande', placeholder: 'Décrivez ce dont vous avez besoin...' },
  ],
  direction: [
    { id: 'plaignant_nom', label: '👤 Votre nom de personnage',  placeholder: 'Prénom Nom' },
    { id: 'role_serveur',  label: '🎭 Votre rôle sur le serveur', placeholder: 'Ex: Citoyen, Staff, Membre d\'organisation...' },
    { id: 'objet',         label: '📌 Objet de votre demande',   placeholder: 'Résumez en une phrase le sujet...' },
    { id: 'faits',         label: '📝 Détails de votre demande', placeholder: 'Expliquez en détail...' },
  ],
  recrutement: [
    { id: 'plaignant_nom',  label: '👤 Nom & prénom du personnage', placeholder: 'Identité RP' },
    { id: 'age_perso',      label: '🎂 Âge du personnage',          placeholder: 'Âge RP' },
    { id: 'poste',          label: '⚖️ Poste souhaité',              placeholder: 'Ex: Juge, Procureur, Avocat, Greffier...' },
    { id: 'experience',     label: '📖 Expérience RP',              placeholder: 'Vos expériences RP...' },
    { id: 'motivation',     label: '💬 Motivation',                 placeholder: 'Pourquoi rejoindre le tribunal ?' },
    { id: 'disponibilites', label: '🕐 Disponibilités',             placeholder: 'Jours et horaires approximatifs...' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DISCORD
// ═══════════════════════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Sessions en mémoire : channelId → { type, step, answers, userId, username, displayName, completed }
const sessions = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE — COMPTEUR TICKETS
// ═══════════════════════════════════════════════════════════════════════════════
async function getNextTicketId() {
  const ref  = db.collection('_meta').doc('ticket_counter');
  const snap = await ref.get();
  const n    = (snap.exists ? snap.data().count : 0) + 1;
  await ref.set({ count: n });
  return `TVG-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE — CRÉER LE DOSSIER
// ═══════════════════════════════════════════════════════════════════════════════
function mapTypeToUI(type) {
  const m = {
    plainte_police: 'plainte', plainte_civil: 'plainte',
    jugement: 'audience', avocat: 'instruction', ppa: 'instruction',
    aide: 'plainte', direction: 'plainte', recrutement: 'plainte',
  };
  return m[type] || 'plainte';
}

async function createDossier(channelId, session) {
  const ticketId = await getNextTicketId();
  const { type, answers } = session;
  const typeInfo = TICKET_TYPES[type];

  const infractions = answers.infractions
    ? answers.infractions.toLowerCase() === 'je ne sais pas' ? []
      : answers.infractions.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const preuves = answers.preuves
    ? answers.preuves.toLowerCase() === 'aucune' ? []
      : answers.preuves.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const dossier = {
    ticket_id:  ticketId,
    type:       mapTypeToUI(type),
    type_label: typeInfo?.label || type,
    statut:     'ouvert',
    plaignant: {
      nom:              answers.plaignant_nom || session.displayName || '—',
      discord_id:       session.userId        || '',
      discord_username: session.username      || '',
    },
    defendeur: {
      nom:        answers.defendeur_nom     || answers.accusé_nom || '—',
      discord_id: answers.defendeur_discord || '',
    },
    faits:       answers.faits || '—',
    infractions,
    preuves,
    form_data:   answers,
    juge_assigne: '', procureur_assigne: '', avocat_defense: '',
    notes: [], messages_discord: [], deliberation: null, verdict: null,
    discord: { channel_id: channelId, guild_id: GUILD_ID },
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    source: 'discord_bot',
  };

  const ref = await db.collection('tickets').add(dossier);
  return { ticketId, docId: ref.id };
}

async function saveMessageToFirestore(channelId, msg) {
  try {
    const snap = await db.collection('tickets')
      .where('discord.channel_id', '==', channelId).limit(1).get();
    if (snap.empty) return;
    const msgs = snap.docs[0].data().messages_discord || [];
    msgs.push({
      id:             msg.id,
      auteur:         msg.author.username,
      auteur_id:      msg.author.id,
      auteur_display: msg.member?.displayName || msg.author.username,
      contenu:        msg.content,
      date:           msg.createdAt.toISOString(),
      est_bot:        msg.author.bot,
    });
    await snap.docs[0].ref.update({ messages_discord: msgs, updated_at: FieldValue.serverTimestamp() });
  } catch (e) { console.error('saveMessage error:', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉER LE SALON TICKET
// ═══════════════════════════════════════════════════════════════════════════════
async function createTicketChannel(guild, member, type) {
  const typeInfo    = TICKET_TYPES[type];
  const channelName = `${typeInfo.emoji}┃${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 22)}`;

  // String() explicite sur tous les IDs pour éviter les erreurs de cache Discord.js
  const everyoneId = String(guild.id);
  const memberId   = String(member.user.id);
  const staffId    = String(ROLE_STAFF_ID);
  const botId      = String(client.user.id);

  return await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: CATEGORIES[type],
    permissionOverwrites: [
      { id: everyoneId, deny:  [PermissionFlagsBits.ViewChannel] },
      { id: memberId,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: staffId,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAIRE
// ═══════════════════════════════════════════════════════════════════════════════
async function startForm(channel, member, type) {
  const typeInfo = TICKET_TYPES[type];

  sessions.set(channel.id, {
    type, step: 0, answers: {},
    userId: member.id, username: member.user.username,
    displayName: member.displayName, completed: false,
  });

  const welcomeEmbed = new EmbedBuilder()
    .setColor(typeInfo.color)
    .setTitle(`${typeInfo.emoji} ${typeInfo.label}`)
    .setDescription(
      `Bonjour **${member.displayName}** !\n\n` +
      `Je vais vous guider pour constituer votre dossier.\n` +
      `**Répondez simplement en écrivant dans ce salon**, question par question.\n\n` +
      `> *Prenez le temps de bien détailler vos réponses.*`
    )
    .setFooter({ text: 'Tribunal de Vogaria • Système judiciaire' });

  await channel.send({ content: `<@${member.id}> <@&${ROLE_STAFF_ID}>`, embeds: [welcomeEmbed] });
  await new Promise(r => setTimeout(r, 800));
  await sendQuestion(channel, sessions.get(channel.id));
}

async function sendQuestion(channel, session) {
  const questions = FORMS[session.type] || FORMS.aide;
  const q         = questions[session.step];
  if (!q) return;

  const embed = new EmbedBuilder()
    .setColor(0x2980b9)
    .setAuthor({ name: `Question ${session.step + 1} sur ${questions.length}` })
    .setDescription(`**${q.label}**\n\n> ${q.placeholder}`)
    .setFooter({ text: `Tapez votre réponse ci-dessous  •  ${questions.length - session.step - 1} question(s) restante(s)` });

  await channel.send({ embeds: [embed] });
}

async function finalizeForm(channel, session) {
  session.completed = true;

  let ticketId = '—';
  try {
    const result     = await createDossier(channel.id, session);
    ticketId         = result.ticketId;
    session.ticketId = ticketId;
    session.docId    = result.docId;
  } catch (e) {
    console.error('Erreur createDossier:', e);
    await channel.send('❌ Erreur lors de l\'enregistrement du dossier. Contactez un administrateur.');
    return;
  }

  const typeInfo = TICKET_TYPES[session.type];

  const resumeEmbed = new EmbedBuilder()
    .setColor(typeInfo.color)
    .setTitle(`📋 Récapitulatif — ${typeInfo.label}`)
    .setDescription(buildResume(session))
    .setFooter({ text: `Dossier ${ticketId}  •  Tribunal de Vogaria` })
    .setTimestamp();

  await channel.send({ embeds: [resumeEmbed] });
  await new Promise(r => setTimeout(r, 500));

  const confirmEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ Dossier enregistré avec succès')
    .setDescription(
      `Votre dossier a été transmis au **Tribunal de Vogaria**.\n` +
      `Un membre de l'équipe judiciaire prendra en charge votre demande.\n\n` +
      `**Conservez bien votre numéro de dossier !**`
    )
    .addFields(
      { name: '📁 N° de dossier', value: `\`${ticketId}\``, inline: true },
      { name: '📂 Type',          value: typeInfo.label,     inline: true },
      { name: '📊 Statut',        value: '🟢 Ouvert',        inline: true },
    )
    .setFooter({ text: 'Tribunal de Vogaria • République Française' });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Fermer ce ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('✅ Pris en charge').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_reopen').setLabel('🔄 Rouvrir').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [confirmEmbed], components: [closeRow] });
}

function buildResume(session) {
  const questions = FORMS[session.type] || FORMS.aide;
  const lines = [];
  for (const q of questions) {
    const answer = session.answers[q.id];
    if (!answer) continue;
    const short = answer.length > 300 ? answer.slice(0, 300) + '…' : answer;
    lines.push(`**${q.label}**\n${short}`);
  }
  return lines.join('\n\n') || '*(Aucune réponse enregistrée)*';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
async function postMainPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(0xd4a82a)
    .setTitle('⚖️  Tribunal de Vogaria — Ouvrir un ticket')
    .setDescription(
      '**Bienvenue au Tribunal de Vogaria.**\n' +
      'Sélectionnez le type de demande correspondant à votre situation.\n\n' +
      '🚔 **Plainte contre un policier** — Signaler un abus ou comportement inapproprié d\'un agent\n' +
      '👤 **Plainte contre un civil** — Déposer une plainte contre un citoyen\n' +
      '⚖️ **Demande de jugement** — Demander l\'ouverture d\'une procédure judiciaire\n' +
      '🧑‍⚖️ **Rendez-vous avocat** — Obtenir une représentation juridique\n' +
      '📄 **Demande de PPA** — Prise en Charge Psychologique et Administrative\n' +
      '❓ **Aide & Question** — Toute question concernant la justice\n' +
      '👑 **Contacter la direction** — Demandes importantes à la direction\n' +
      '📋 **Recrutement** — Rejoindre l\'équipe judiciaire'
    )
    .setFooter({ text: 'Tribunal de Vogaria • République Française' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_plainte_police').setLabel('Plainte policier').setEmoji('🚔').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('open_plainte_civil').setLabel('Plainte civil').setEmoji('👤').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_jugement').setLabel('Demande jugement').setEmoji('⚖️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_avocat').setLabel('RDV Avocat').setEmoji('🧑‍⚖️').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ppa').setLabel('Demande PPA').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_aide').setLabel('Aide & Question').setEmoji('❓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('open_direction').setLabel('Direction').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_recrutement').setLabel('Recrutement').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [embed], components: [row1, row2] });
  console.log('✅ Panel posté dans #' + channel.name);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FERMER UN TICKET
// ═══════════════════════════════════════════════════════════════════════════════
async function closeTicket(channel, closedBy) {
  const session = sessions.get(channel.id);

  try {
    const snap = await db.collection('tickets')
      .where('discord.channel_id', '==', channel.id).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        statut: 'archive', updated_at: FieldValue.serverTimestamp(),
        closed_by: closedBy?.displayName || closedBy?.user?.username || 'Staff',
        closed_at: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) { console.error('Firestore close error:', e); }

  const embed = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle('🔒 Ticket fermé')
    .setDescription(
      `Ce ticket a été fermé par <@${closedBy.id}>.\n` +
      (session?.ticketId ? `**N° de dossier :** \`${session.ticketId}\`\n` : '') +
      `\nLe salon sera supprimé dans **5 secondes**.`
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  sessions.delete(channel.id);
  setTimeout(async () => { try { await channel.delete(); } catch {} }, 5000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════
client.once(Events.ClientReady, async () => {
  console.log(`\n✅ Bot connecté : ${client.user.tag}`);
  console.log(`   Guild : ${GUILD_ID}`);
  console.log(`   Panel channel : ${PANEL_CHANNEL_ID}\n`);

  client.user.setActivity('Tribunal de Vogaria ⚖️', { type: 3 });

  try {
    const guild        = await client.guilds.fetch(GUILD_ID);
    const panelChannel = await guild.channels.fetch(PANEL_CHANNEL_ID);
    const messages     = await panelChannel.messages.fetch({ limit: 10 });
    const alreadyPosted = messages.some(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (!alreadyPosted) await postMainPanel(panelChannel);
    else console.log('ℹ️  Panel déjà posté, pas de repost.');
  } catch (e) { console.error('Erreur init panel:', e.message); }
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    // ── Ouvrir un ticket ──
    if (interaction.isButton() && interaction.customId.startsWith('open_')) {
      const type   = interaction.customId.replace('open_', '');
      const guild  = interaction.guild;
      const member = interaction.member;

      if (!TICKET_TYPES[type]) {
        await interaction.reply({ content: '❌ Type de ticket inconnu.', flags: 64 });
        return;
      }

      // Vérifier ticket existant
      try {
        const existing = await db.collection('tickets')
          .where('plaignant.discord_id', '==', member.id)
          .where('statut', 'in', ['ouvert', 'en_cours', 'audience'])
          .limit(1).get();

        if (!existing.empty) {
          const existingTicketId = existing.docs[0].data().ticket_id;
          await interaction.reply({
            content: `❌ Vous avez déjà un ticket en cours (**${existingTicketId}**). Fermez-le avant d'en ouvrir un nouveau.`,
            flags: 64,
          });
          return;
        }
      } catch (e) { /* si erreur Firestore on continue */ }

      await interaction.deferReply({ flags: 64 });

      try {
        const channel = await createTicketChannel(guild, member, type);
        await startForm(channel, member, type);
        await interaction.editReply({ content: `✅ Votre ticket a été créé : <#${channel.id}>\nRemplissez le formulaire dans ce salon.` });
      } catch (e) {
        console.error('Erreur création ticket:', e);
        await interaction.editReply({ content: `❌ Erreur : ${e.message}` });
      }
      return;
    }

    // ── Fermer le ticket ──
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      const member    = interaction.member;
      const isStaff   = member.roles.cache.has(ROLE_STAFF_ID);
      const isCreator = sessions.get(interaction.channelId)?.userId === member.id;

      if (!isStaff && !isCreator) {
        await interaction.reply({ content: '❌ Seul le staff peut fermer ce ticket.', flags: 64 });
        return;
      }
      await interaction.deferUpdate();
      await closeTicket(interaction.channel, member);
      return;
    }

    // ── Pris en charge ──
    if (interaction.isButton() && interaction.customId === 'ticket_claim') {
      if (!interaction.member.roles.cache.has(ROLE_STAFF_ID)) {
        await interaction.reply({ content: '❌ Réservé au staff.', flags: 64 });
        return;
      }
      await interaction.reply({ content: `✅ Ticket pris en charge par <@${interaction.user.id}>` });
      try {
        const snap = await db.collection('tickets')
          .where('discord.channel_id', '==', interaction.channelId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({
            statut: 'en_cours', juge_assigne: interaction.member.displayName,
            updated_at: FieldValue.serverTimestamp(),
          });
        }
      } catch (e) { console.error('Claim update error:', e); }
      return;
    }

    // ── Rouvrir ──
    if (interaction.isButton() && interaction.customId === 'ticket_reopen') {
      if (!interaction.member.roles.cache.has(ROLE_STAFF_ID)) {
        await interaction.reply({ content: '❌ Réservé au staff.', flags: 64 });
        return;
      }
      await interaction.reply({ content: '🔄 Ticket rouvert.' });
      try {
        const snap = await db.collection('tickets')
          .where('discord.channel_id', '==', interaction.channelId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ statut: 'ouvert', updated_at: FieldValue.serverTimestamp() });
        }
      } catch (e) {}
      return;
    }

  } catch (e) {
    if (e.code === 10062) return; // Interaction expirée, on ignore
    console.error('Interaction error:', e);
  }
});

// ── Messages dans les salons de ticket ───────────────────────────────────────
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot)           return;
  if (msg.guildId !== GUILD_ID) return;

  const channelId = msg.channelId;
  const parentId  = msg.channel.parentId;

  if (!Object.values(CATEGORIES).includes(parentId)) return;

  const session = sessions.get(channelId);

  if (session && !session.completed) {
    const questions = FORMS[session.type] || FORMS.aide;
    const q         = questions[session.step];
    if (!q) return;

    session.answers[q.id] = msg.content;
    session.step++;

    if (session.step < questions.length) {
      await new Promise(r => setTimeout(r, 300));
      await sendQuestion(msg.channel, session);
    } else {
      await finalizeForm(msg.channel, session);
    }
    return;
  }

  await saveMessageToFirestore(channelId, msg);
});

// ── Channel supprimé ──────────────────────────────────────────────────────────
client.on(Events.ChannelDelete, async (channel) => {
  if (channel.guildId !== GUILD_ID) return;
  if (!Object.values(CATEGORIES).includes(channel.parentId)) return;

  sessions.delete(channel.id);

  try {
    const snap = await db.collection('tickets')
      .where('discord.channel_id', '==', channel.id).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ statut: 'archive', updated_at: FieldValue.serverTimestamp() });
    }
  } catch (e) { console.error('ChannelDelete archive error:', e); }
});

// ── Commande !panel ───────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot)                              return;
  if (msg.content !== '!panel')                    return;
  if (!msg.member?.roles.cache.has(ROLE_STAFF_ID)) return;
  await postMainPanel(msg.channel);
  await msg.delete().catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVEUR HTTP (pour garder Render actif)
// ═══════════════════════════════════════════════════════════════════════════════
const http = require('http');
http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

// ═══════════════════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════════════════
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🔐 Login réussi'))
  .catch(e  => { console.error('❌ Login échoué:', e.message); process.exit(1); });
