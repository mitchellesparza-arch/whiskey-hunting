const WEBHOOK_URL = 'https://discord.com/api/webhooks/1517211815418007714/yqt0asGEnU1DLkE9xBtEm3bBU_SsUEEQaKeUYEeaHvilpFeLM-NrlaoLzHdWlO8NBX7l'

const find = {
  bottleName:    '[TEST] Blanton\'s Original Single Barrel',
  submitterName: 'Mitch E.',
  store: {
    name:    'Binny\'s Beverage Depot — Plainfield',
    address: '2528 IL-59, Plainfield, IL 60586, USA',
  },
  price:    49.99,
  notes:    'This is a test post — not a real find',
  photoUrl: 'https://whiskey-hunter.vercel.app/Test.jpg',
}

const threadName = `🥃 ${find.bottleName} — ${find.store.name}`

const fields = []
if (find.store?.name)    fields.push({ name: '📍 Store',   value: find.store.name,      inline: true  })
if (find.price)          fields.push({ name: '💵 Price',   value: `$${find.price}`,      inline: true  })
if (find.store?.address) fields.push({ name: '🗺️ Address', value: `[${find.store.address}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(find.store.address)})`, inline: false })
if (find.notes)          fields.push({ name: '📝 Notes',   value: find.notes,            inline: false })

const payload = {
  thread_name: threadName,
  username:    'Tater Tracker',
  avatar_url:  'https://whiskey-hunter.vercel.app/CURRENT.png',
  embeds: [{
    description: `**${find.submitterName}** just spotted this — [tap here to see the full find](https://whiskey-hunter.vercel.app/finds)`,
    color:       0xe8943a,
    fields,
    image:       find.photoUrl ? { url: find.photoUrl } : undefined,
    footer:      { text: 'Tater Tracker · log your own finds at the link above' },
    timestamp:   new Date().toISOString(),
  }],
}

console.log('Posting to BOB test webhook...')
console.log('Thread name:', threadName)

const res = await fetch(WEBHOOK_URL, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify(payload),
})

console.log('Status:', res.status, res.statusText)
if (!res.ok) {
  const body = await res.text()
  console.error('Error body:', body)
} else {
  console.log('Success — check the Discord test channel.')
}
