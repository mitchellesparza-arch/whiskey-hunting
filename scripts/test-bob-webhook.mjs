const WEBHOOK_URL = 'https://discord.com/api/webhooks/1516567923324489878/QyiaTdynJAR3pWyNofavjWwftdz_u171FYzA5timZJ1CbRtUDujr51AkfZlNWaEs7lQO'

const find = {
  bottleName:    'Eagle Rare 17 Year BTAC',
  submitterName: 'Mitch E.',
  store: {
    name:    'Binny\'s Beverage Depot',
    address: '213 W Grand Ave, Chicago, IL 60654, USA',
  },
  price:    89.99,
  notes:    'Found 2 bottles on the shelf, no limit posted',
  photoUrl: null,
}

const threadName = `🥃 ${find.bottleName} — ${find.store.name}`

const fields = []
if (find.store?.name)    fields.push({ name: '📍 Store',   value: find.store.name,      inline: true  })
if (find.store?.address) fields.push({ name: '🗺️ Address', value: find.store.address,   inline: true  })
if (find.price)          fields.push({ name: '💵 Price',   value: `$${find.price}`,      inline: true  })
if (find.notes)          fields.push({ name: '📝 Notes',   value: find.notes,            inline: false })

const payload = {
  thread_name: threadName,
  username:    'Tater Tracker',
  avatar_url:  'https://whiskey-hunter.vercel.app/CURRENT.png',
  embeds: [{
    description: `**${find.submitterName}** just spotted this — tap below to see the full find`,
    url:         'https://whiskey-hunter.vercel.app/finds',
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
