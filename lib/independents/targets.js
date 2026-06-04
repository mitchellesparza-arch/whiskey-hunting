/**
 * lib/independents/targets.js
 *
 * Regex patterns for allocated bottles we track across all independent retailers.
 * Each entry: { pattern (RegExp), name (canonical display name) }
 *
 * Used by City Hive and Malloy's to match product names from their catalogs.
 * Shopify stores use explicit slug lists instead.
 *
 * Verified against hotlineBottles in lib/bottles.js — every bottle on that list
 * has a matching pattern here.
 */

export const TARGETS = [
  // ── Buffalo Trace / Sazerac ──────────────────────────────────────────────────
  { pattern: /eagle\s*rare/i,                                     name: 'Eagle Rare' },
  { pattern: /blanton'?s/i,                                       name: "Blanton's" },
  { pattern: /weller\s+special\s+reserve/i,                       name: 'Weller Special Reserve' },
  { pattern: /weller\s+12/i,                                      name: 'Weller 12yr' },
  { pattern: /weller\s+antique/i,                                 name: 'Weller Antique 107' },
  { pattern: /weller\s+full\s+proof/i,                            name: 'Weller Full Proof' },
  { pattern: /weller\s+(cypb|craft\s+your\s+path)/i,              name: 'Weller CYPB' },
  { pattern: /weller\s+single\s+barrel/i,                         name: 'Weller Single Barrel' },
  { pattern: /weller\s+millennium/i,                              name: 'Weller Millennium' },
  { pattern: /william\s+larue\s+weller/i,                         name: 'William Larue Weller (BTAC)' },
  { pattern: /george\s+t[\.\s]+stagg(?!\s+jr)/i,                  name: 'George T. Stagg (BTAC)' },
  { pattern: /stagg\s+jr/i,                                       name: 'Stagg Jr.' },
  { pattern: /\bstagg\b(?!\s+jr)/i,                               name: 'Stagg' },
  { pattern: /thomas\s+h[\.\s]+handy/i,                           name: 'Thomas H. Handy (BTAC)' },
  { pattern: /sazerac\s+18/i,                                     name: 'Sazerac 18yr (BTAC)' },
  { pattern: /sazerac\s+6/i,                                      name: 'Sazerac 6yr Rye' },
  { pattern: /e\.?h\.?\s*taylor|colonel\s+e\.?h\.?\s*taylor/i,    name: 'E.H. Taylor' },
  { pattern: /rock\s+hill\s+farms/i,                              name: 'Rock Hill Farms' },
  { pattern: /old\s+charter\s+oak/i,                              name: 'Old Charter Oak' },
  { pattern: /double\s+eagle\s+very\s+rare/i,                     name: 'Double Eagle Very Rare' },
  { pattern: /buffalo\s+trace/i,                                  name: 'Buffalo Trace' },
  { pattern: /a\.?\s*smith\s+bowman/i,                            name: 'A. Smith Bowman' },

  // ── Van Winkle ────────────────────────────────────────────────────────────────
  { pattern: /pappy\s+van\s+winkle/i,                             name: 'Pappy Van Winkle' },
  { pattern: /old\s+rip\s+van\s+winkle/i,                         name: 'Old Rip Van Winkle 10yr' },
  { pattern: /van\s+winkle/i,                                     name: 'Van Winkle' },

  // ── Heaven Hill ───────────────────────────────────────────────────────────────
  { pattern: /old\s+fitzgerald\s+decanter/i,                      name: 'Old Fitzgerald Decanter Series' },
  { pattern: /old\s+fitzgerald\s+(bottle|bottled|bib|b-i-b|\d)/i, name: 'Old Fitzgerald BIB' },
  { pattern: /elijah\s+craig\s+(barrel\s+proof|bp)/i,             name: 'Elijah Craig Barrel Proof' },
  { pattern: /elijah\s+craig\s+toasted/i,                         name: 'Elijah Craig Toasted' },
  { pattern: /elijah\s+craig\s+(15|18)\s*yr/i,                    name: 'Elijah Craig Limited' },
  { pattern: /parker'?s\s+heritage/i,                             name: "Parker's Heritage" },
  { pattern: /larceny\s+barrel\s+proof/i,                         name: 'Larceny Barrel Proof' },
  { pattern: /heaven\s+hill\s+(heritage|9[05]th)/i,               name: 'Heaven Hill Heritage' },
  { pattern: /bernheim\s+wheat/i,                                 name: 'Bernheim Wheat Whiskey' },
  { pattern: /henry\s+mckenna/i,                                  name: 'Henry McKenna 10yr BIB' },
  { pattern: /old\s+man\s+winter/i,                               name: 'Old Man Winter' },

  // ── Brown-Forman ──────────────────────────────────────────────────────────────
  { pattern: /woodford\s+reserve\s+batch\s+proof/i,               name: 'Woodford Reserve Batch Proof' },
  { pattern: /woodford\s+reserve\s+master'?s\s+collection/i,      name: "Woodford Reserve Master's Collection" },
  { pattern: /woodford\s+reserve\s+baccarat/i,                    name: 'Woodford Reserve Baccarat Edition' },
  { pattern: /woodford\s+reserve\s+double\s+double/i,             name: 'Woodford Reserve Double Double Oaked' },
  { pattern: /old\s+forester\s+(birthday|117|1924|barrel\s+proof)/i, name: 'Old Forester Limited' },
  { pattern: /king\s+of\s+kentucky/i,                             name: 'King of Kentucky' },
  { pattern: /jack\s+daniel'?s\s+(10|12|14)\s*yr/i,               name: "Jack Daniel's Limited" },
  { pattern: /jack\s+daniel'?s\s+(single\s+barrel|barrel\s+proof|tanyard|coy\s+hill)/i, name: "Jack Daniel's Limited" },
  { pattern: /bardstown\s+bourbon/i,                              name: 'Bardstown Bourbon Co.' },
  { pattern: /13th\s+colony/i,                                    name: '13th Colony' },

  // ── Beam Suntory ──────────────────────────────────────────────────────────────
  { pattern: /booker'?s\s+(9|bourbon)/i,                          name: "Booker's Bourbon" },
  { pattern: /knob\s+creek\s+(9|12|18|21)\s*yr/i,                 name: 'Knob Creek Limited' },
  { pattern: /knob\s+creek\s+single\s+barrel/i,                   name: 'Knob Creek Single Barrel' },
  { pattern: /little\s+book/i,                                    name: 'Little Book' },
  { pattern: /baker'?s\s+13/i,                                    name: "Baker's 13yr" },
  { pattern: /maker'?s\s+mark\s+(cellar|star\s+hill|greats|wood\s+finish|cask|fae|french)/i, name: "Maker's Mark Limited" },

  // ── Campari / Wild Turkey ─────────────────────────────────────────────────────
  { pattern: /russell'?s\s+reserve\s+(13|15|rickhouse|single\s+barrel)/i, name: "Russell's Reserve Limited" },
  { pattern: /wild\s+turkey\s+(master|rare\s+breed\s+(rye|barrel\s+proof))/i, name: 'Wild Turkey Limited' },

  // ── Angel's Envy ──────────────────────────────────────────────────────────────
  { pattern: /angel'?s\s+envy\s+(cask|single\s+barrel|finished\s+rye)/i, name: "Angel's Envy Limited" },

  // ── Four Roses ────────────────────────────────────────────────────────────────
  { pattern: /four\s+roses\s+elliott'?s/i,                        name: "Four Roses Elliott's Select" },
  { pattern: /four\s+roses\s+(limited|single\s+barrel|small\s+batch|barrel\s+proof|\d{4}|obs[a-z])/i, name: 'Four Roses Limited' },

  // ── WhistlePig ────────────────────────────────────────────────────────────────
  { pattern: /whistlepig\s+(15|18|(the\s+)?boss\s+hog)/i,         name: 'WhistlePig Limited' },

  // ── Michter's ─────────────────────────────────────────────────────────────────
  { pattern: /michter'?s\s+(10|20|25)\s*yr/i,                     name: "Michter's Limited" },
  { pattern: /michter'?s\s+(toasted|sour\s+mash)/i,               name: "Michter's Toasted" },
  { pattern: /michter'?s\s+us[\*\s]*1/i,                          name: "Michter's US*1" },

  // ── Barrell / Willett / Peerless ──────────────────────────────────────────────
  { pattern: /barrell\s+(bourbon\s+)?(seagrass|dovetail|vantage|cask\s+strength|sherry|foundation|new\s+year|armida)/i, name: 'Barrell Limited' },
  { pattern: /willett\s+(family\s+estate|\d+\s*yr|pot\s+still|last\s+juice)/i, name: 'Willett Limited' },
  { pattern: /peerless\s+(double\s+oak|single\s+barrel|barrel\s+proof)/i, name: 'Peerless' },

  // ── High West ────────────────────────────────────────────────────────────────
  { pattern: /high\s+west\s+(a\s+)?(bourye|midwinter|rendezvous)/i, name: 'High West Limited' },

  // ── Worth watching ────────────────────────────────────────────────────────────
  { pattern: /new\s+riff\s+\d+\s*yr/i,                            name: 'New Riff Limited' },
  { pattern: /blood\s+oath\s+pact/i,                              name: 'Blood Oath Pact' },
  { pattern: /blade\s+and\s+bow\s+30/i,                           name: 'Blade and Bow 30yr' },
  { pattern: /elmer\s+t[\.\s]+lee/i,                              name: 'Elmer T. Lee' },
  { pattern: /old\s+overholt\s+12/i,                              name: 'Old Overholt 12yr' },
  { pattern: /1792\s+(12|barrel\s+select|bottled|single|cognac)/i, name: '1792 Limited' },
  { pattern: /fortaleza/i,                                         name: 'Fortaleza' },
  { pattern: /smoke\s*wagon\s+(rare|uncut|straight|limited)/i,    name: 'Smoke Wagon' },
  { pattern: /joseph\s+magnus/i,                                  name: 'Joseph Magnus' },
  { pattern: /johnny\s+drum/i,                                    name: 'Johnny Drum' },
  { pattern: /noah'?s\s+mill/i,                                   name: "Noah's Mill" },
  { pattern: /rowan'?s\s+creek/i,                                 name: "Rowan's Creek" },
  { pattern: /rare\s+character/i,                                 name: 'Rare Character' },
  { pattern: /woodford\s+reserve\s+batch\s+proof/i,               name: 'Woodford Reserve Batch Proof' },
  { pattern: /weller\s+single\s+barrel/i,                         name: 'Weller Single Barrel' },
  { pattern: /weller\s+millennium/i,                              name: 'Weller Millennium' },
  { pattern: /wild\s+turkey\s+rare\s+breed\s+rye/i,               name: 'Wild Turkey Rare Breed Rye' },
  { pattern: /double\s+eagle\s+very\s+rare/i,                     name: 'Double Eagle Very Rare' },
  { pattern: /sazerac\s+6/i,                                      name: 'Sazerac 6yr Rye' },
]
