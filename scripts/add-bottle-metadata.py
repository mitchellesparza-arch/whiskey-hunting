#!/usr/bin/env python3
"""
Adds 7 new metadata fields to every entry in market-prices-data.json:
  distillery, proof, age, sizes, origin, region, type
"""
import json, sys, os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'lib', 'market-prices-data.json')

# name → metadata dict
METADATA = {
  # ── Buffalo Trace ──────────────────────────────────────────────────────────
  "Blanton's Original Single Barrel":         {"distillery":"Buffalo Trace Distillery","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Blanton's Gold Edition":                    {"distillery":"Buffalo Trace Distillery","proof":103,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Blanton's Straight from the Barrel":        {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Eagle Rare 10 Year":                        {"distillery":"Buffalo Trace Distillery","proof":90,"age":"10 Year","sizes":["750ml","1.75L"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Eagle Rare 17 Year":                        {"distillery":"Buffalo Trace Distillery","proof":90,"age":"17 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Buffalo Trace Bourbon":                     {"distillery":"Buffalo Trace Distillery","proof":90,"age":"NAS","sizes":["750ml","375ml","1L","1.75L"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Buffalo Trace Kosher Wheat Recipe":         {"distillery":"Buffalo Trace Distillery","proof":90,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Buffalo Trace Kosher Rye Recipe":           {"distillery":"Buffalo Trace Distillery","proof":90,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rock Hill Farms Single Barrel":             {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Hancock's President's Reserve":             {"distillery":"Buffalo Trace Distillery","proof":88.9,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Benchmark Top Floor":                       {"distillery":"Buffalo Trace Distillery","proof":101.4,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Charter Oak French Oak":                {"distillery":"Buffalo Trace Distillery","proof":96,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Charter Oak Canadian Oak":              {"distillery":"Buffalo Trace Distillery","proof":96,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Caribou Crossing Single Barrel":            {"distillery":"Sazerac Company","proof":80,"age":"NAS","sizes":["750ml"],"origin":"Canada","region":"Canada","type":"Canadian Whisky"},
  # ── Weller / Van Winkle ────────────────────────────────────────────────────
  "W.L. Weller Special Reserve":               {"distillery":"Buffalo Trace Distillery","proof":90,"age":"NAS","sizes":["750ml","1.75L"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "W.L. Weller 12 Year":                       {"distillery":"Buffalo Trace Distillery","proof":90,"age":"12 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "W.L. Weller Full Proof":                    {"distillery":"Buffalo Trace Distillery","proof":114,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "W.L. Weller Antique 107":                   {"distillery":"Buffalo Trace Distillery","proof":107,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "William Larue Weller":                      {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "W.L. Weller CYPB":                          {"distillery":"Buffalo Trace Distillery","proof":95,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Pappy Van Winkle 10 Year":                  {"distillery":"Buffalo Trace Distillery","proof":107,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Pappy Van Winkle 12 Year":                  {"distillery":"Buffalo Trace Distillery","proof":90.4,"age":"12 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Pappy Van Winkle 15 Year":                  {"distillery":"Buffalo Trace Distillery","proof":107,"age":"15 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Pappy Van Winkle 20 Year":                  {"distillery":"Buffalo Trace Distillery","proof":90.4,"age":"20 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Pappy Van Winkle 23 Year":                  {"distillery":"Buffalo Trace Distillery","proof":95.6,"age":"23 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  # ── BTAC ──────────────────────────────────────────────────────────────────
  "George T. Stagg":                           {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Thomas H. Handy Sazerac":                   {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Sazerac 18 Year Rye":                       {"distillery":"Buffalo Trace Distillery","proof":90,"age":"18 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Stagg Jr.":                                 {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── E.H. Taylor ───────────────────────────────────────────────────────────
  "E.H. Taylor Small Batch":                   {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "E.H. Taylor Single Barrel":                 {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "E.H. Taylor Barrel Proof":                  {"distillery":"Buffalo Trace Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "E.H. Taylor Straight Rye":                  {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "E.H. Taylor Warehouse C Tornado Surviving": {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "E.H. Taylor Four Grain":                    {"distillery":"Buffalo Trace Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Heaven Hill ───────────────────────────────────────────────────────────
  "Elijah Craig Barrel Proof":                 {"distillery":"Heaven Hill Distillery","proof":"Variable","age":"12 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Elijah Craig Small Batch":                  {"distillery":"Heaven Hill Distillery","proof":94,"age":"12 Year","sizes":["750ml","375ml","1.75L"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Elijah Craig 18 Year Single Barrel":        {"distillery":"Heaven Hill Distillery","proof":90,"age":"18 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Elijah Craig 23 Year":                      {"distillery":"Heaven Hill Distillery","proof":90,"age":"23 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Larceny Barrel Proof":                      {"distillery":"Heaven Hill Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Henry McKenna 10 Year Bottled in Bond":     {"distillery":"Heaven Hill Distillery","proof":100,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Evan Williams Single Barrel Vintage":       {"distillery":"Heaven Hill Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Fitzgerald Bottled in Bond 8 Year":     {"distillery":"Heaven Hill Distillery","proof":100,"age":"8 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Old Fitzgerald Bottled in Bond 11 Year":    {"distillery":"Heaven Hill Distillery","proof":100,"age":"11 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Old Fitzgerald Bottled in Bond 13 Year":    {"distillery":"Heaven Hill Distillery","proof":100,"age":"13 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Old Fitzgerald Bottled in Bond 14 Year":    {"distillery":"Heaven Hill Distillery","proof":100,"age":"14 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Old Fitzgerald Bottled in Bond":            {"distillery":"Heaven Hill Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Parker's Heritage Collection":              {"distillery":"Heaven Hill Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Heaven Hill 7 Year Bottled in Bond":        {"distillery":"Heaven Hill Distillery","proof":100,"age":"7 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Four Roses ────────────────────────────────────────────────────────────
  "Four Roses Small Batch Select":             {"distillery":"Four Roses Distillery","proof":104,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Single Barrel":                  {"distillery":"Four Roses Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Limited Small Batch":            {"distillery":"Four Roses Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Limited Single Barrel":          {"distillery":"Four Roses Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Elliott's Select":               {"distillery":"Four Roses Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Al Young 50th Anniversary":      {"distillery":"Four Roses Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Single Barrel OBSK":             {"distillery":"Four Roses Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Four Roses Single Barrel OBSF":             {"distillery":"Four Roses Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Wild Turkey ───────────────────────────────────────────────────────────
  "Wild Turkey 101":                           {"distillery":"Wild Turkey Distillery","proof":101,"age":"NAS","sizes":["750ml","375ml","1L","1.75L"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey 81":                            {"distillery":"Wild Turkey Distillery","proof":81,"age":"NAS","sizes":["750ml","375ml","1.75L"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey Rare Breed":                    {"distillery":"Wild Turkey Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey Russell's Reserve 10 Year":     {"distillery":"Wild Turkey Distillery","proof":90,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Russell's Reserve Single Barrel Bourbon":   {"distillery":"Wild Turkey Distillery","proof":110,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Russell's Reserve Single Barrel Rye":       {"distillery":"Wild Turkey Distillery","proof":104,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Wild Turkey Master's Keep Decades":         {"distillery":"Wild Turkey Distillery","proof":104,"age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey Master's Keep Revival":         {"distillery":"Wild Turkey Distillery","proof":101,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey Master's Keep Unforgotten":     {"distillery":"Wild Turkey Distillery","proof":104,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Blended Whiskey"},
  "Wild Turkey Master's Keep Bottled in Bond": {"distillery":"Wild Turkey Distillery","proof":100,"age":"17 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Wild Turkey Kentucky Spirit":               {"distillery":"Wild Turkey Distillery","proof":101,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Old Forester ──────────────────────────────────────────────────────────
  "Old Forester Birthday Bourbon":             {"distillery":"Old Forester Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Forester 1910 Old Fine Whisky":         {"distillery":"Old Forester Distillery","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Forester 1897 Bottled in Bond":         {"distillery":"Old Forester Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Forester 1920 Prohibition Style":       {"distillery":"Old Forester Distillery","proof":115,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Forester 1924 10 Year":                 {"distillery":"Old Forester Distillery","proof":95,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Old Forester Statesman":                    {"distillery":"Old Forester Distillery","proof":95,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Woodford Reserve ──────────────────────────────────────────────────────
  "Woodford Reserve Batch Proof":              {"distillery":"Woodford Reserve Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Woodford Reserve Master's Collection":      {"distillery":"Woodford Reserve Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Woodford Reserve Double Oaked":             {"distillery":"Woodford Reserve Distillery","proof":90.4,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Woodford Reserve Distillery Series":        {"distillery":"Woodford Reserve Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Woodford Reserve Personal Selection":       {"distillery":"Woodford Reserve Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Michter's ─────────────────────────────────────────────────────────────
  "Michter's US*1 Small Batch Bourbon":        {"distillery":"Michter's Distillery","proof":91.4,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Michter's US*1 Rye":                        {"distillery":"Michter's Distillery","proof":84.8,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Michter's US*1 Sour Mash":                  {"distillery":"Michter's Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"American Whiskey"},
  "Michter's 10 Year Bourbon":                 {"distillery":"Michter's Distillery","proof":94.4,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Michter's 10 Year Rye":                     {"distillery":"Michter's Distillery","proof":92.8,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Michter's 20 Year Bourbon":                 {"distillery":"Michter's Distillery","proof":92.2,"age":"20 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Michter's 25 Year Bourbon":                 {"distillery":"Michter's Distillery","proof":100.2,"age":"25 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Michter's Celebration Sour Mash":           {"distillery":"Michter's Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"American Whiskey"},
  # ── Angel's Envy ──────────────────────────────────────────────────────────
  "Angel's Envy Port Barrel Finish":           {"distillery":"Angel's Envy Distillery","proof":86.6,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Angel's Envy Cask Strength":                {"distillery":"Angel's Envy Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Angel's Envy Bottled in Bond":              {"distillery":"Angel's Envy Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Angel's Envy Rye":                          {"distillery":"Angel's Envy Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  # ── Jefferson's ───────────────────────────────────────────────────────────
  "Jefferson's Ocean Aged at Sea":             {"distillery":"Jefferson's Distillery","proof":90,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Jefferson's Presidential Select 21 Year":  {"distillery":"Jefferson's Distillery","proof":94,"age":"21 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Jefferson's Very Old Very Small Batch":     {"distillery":"Jefferson's Distillery","proof":99.1,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Jefferson's Chef's Collaboration":          {"distillery":"Jefferson's Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Knob Creek / Booker's ─────────────────────────────────────────────────
  "Knob Creek 2001 Limited Edition":           {"distillery":"Jim Beam Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Knob Creek Single Barrel Reserve":          {"distillery":"Jim Beam Distillery","proof":120,"age":"9 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Knob Creek Cask Strength Rye":              {"distillery":"Jim Beam Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Knob Creek 25th Anniversary":               {"distillery":"Jim Beam Distillery","proof":125,"age":"25 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Booker's Bourbon":                          {"distillery":"Jim Beam Distillery","proof":"Variable","age":"6-8 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Booker's Granny's Batch":                   {"distillery":"Jim Beam Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Booker's Center Cut":                       {"distillery":"Jim Beam Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Booker's Big Man Small Batch":              {"distillery":"Jim Beam Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Booker's 30th Anniversary":                 {"distillery":"Jim Beam Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Maker's Mark ──────────────────────────────────────────────────────────
  "Maker's Mark Cask Strength":                {"distillery":"Maker's Mark Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Maker's Mark 46":                           {"distillery":"Maker's Mark Distillery","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Maker's Mark Private Select":               {"distillery":"Maker's Mark Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Maker's Mark Wood Finishing Series":        {"distillery":"Maker's Mark Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  # ── WhistlePig ────────────────────────────────────────────────────────────
  "WhistlePig 10 Year":                        {"distillery":"WhistlePig Farm","proof":100,"age":"10 Year","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig 12 Year Old World":              {"distillery":"WhistlePig Farm","proof":86,"age":"12 Year","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig 15 Year Vermont Oak":            {"distillery":"WhistlePig Farm","proof":92,"age":"15 Year","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig 18 Year Double Malt":            {"distillery":"WhistlePig Farm","proof":88,"age":"18 Year","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig The Boss Hog":                   {"distillery":"WhistlePig Farm","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig FarmStock":                      {"distillery":"WhistlePig Farm","proof":86,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig Piggyback":                      {"distillery":"WhistlePig Farm","proof":96,"age":"6 Year","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig Beholden":                       {"distillery":"WhistlePig Farm","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  "WhistlePig Smokestock":                     {"distillery":"WhistlePig Farm","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Vermont","type":"Rye"},
  # ── Willett ───────────────────────────────────────────────────────────────
  "Willett Family Estate Pot Still 4 Year":    {"distillery":"Willett Distillery","proof":"Variable","age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Willett Family Estate Pot Still 5 Year":    {"distillery":"Willett Distillery","proof":"Variable","age":"5 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Willett Family Estate Rye":                 {"distillery":"Willett Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Noah's Mill Bourbon":                       {"distillery":"Willett Distillery","proof":114.3,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rowan's Creek Bourbon":                     {"distillery":"Willett Distillery","proof":100.1,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Pure Kentucky XO":                          {"distillery":"Willett Distillery","proof":107.2,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Johnny Drum Private Stock":                 {"distillery":"Willett Distillery","proof":101,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Bardstown Bourbon Co. ─────────────────────────────────────────────────
  "Bardstown Bourbon Co. Fusion Series":       {"distillery":"Bardstown Bourbon Company","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Bardstown Bourbon Co. Discovery Series":    {"distillery":"Bardstown Bourbon Company","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Bardstown Bourbon Co. Collaborative Series":{"distillery":"Bardstown Bourbon Company","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Bardstown Bourbon Co. Origin Series":       {"distillery":"Bardstown Bourbon Company","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── High West ─────────────────────────────────────────────────────────────
  "High West Midwinter Night's Dram":          {"distillery":"High West Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Rye"},
  "High West Yippee Ki-Yay":                   {"distillery":"High West Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Blended Whiskey"},
  "High West Bourye":                          {"distillery":"High West Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Blended Whiskey"},
  "High West Campfire":                        {"distillery":"High West Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Blended Whiskey"},
  "High West Rendezvous Rye":                  {"distillery":"High West Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Rye"},
  "High West Double Rye":                      {"distillery":"High West Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Utah","type":"Rye"},
  # ── Garrison Brothers ─────────────────────────────────────────────────────
  "Garrison Brothers Small Batch":             {"distillery":"Garrison Brothers Distillery","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers Single Barrel":           {"distillery":"Garrison Brothers Distillery","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers Cowboy Bourbon":          {"distillery":"Garrison Brothers Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers Balmorhea":               {"distillery":"Garrison Brothers Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers Guadalupe":               {"distillery":"Garrison Brothers Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers HonkyTonk":               {"distillery":"Garrison Brothers Distillery","proof":90,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Garrison Brothers Laguna Madre":            {"distillery":"Garrison Brothers Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  # ── Barrell Craft Spirits ─────────────────────────────────────────────────
  "Barrell Bourbon Batch":                     {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Barrell Whiskey Armida":                    {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"American Whiskey"},
  "Barrell Whiskey Vantage":                   {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"American Whiskey"},
  "Barrell Gold Label":                        {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Barrell Seascape":                          {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"American Whiskey"},
  "Barrel Bourbon":                            {"distillery":"Barrell Craft Spirits","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── New Riff ──────────────────────────────────────────────────────────────
  "New Riff Bottled in Bond Bourbon":          {"distillery":"New Riff Distillery","proof":100,"age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "New Riff Bottled in Bond Rye":              {"distillery":"New Riff Distillery","proof":100,"age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "New Riff Single Barrel Bourbon":            {"distillery":"New Riff Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "New Riff Malted Rye":                       {"distillery":"New Riff Distillery","proof":100,"age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  # ── Rabbit Hole ───────────────────────────────────────────────────────────
  "Rabbit Hole Dareringer":                    {"distillery":"Rabbit Hole Distillery","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rabbit Hole Heigold":                       {"distillery":"Rabbit Hole Distillery","proof":95,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rabbit Hole Cavehill":                      {"distillery":"Rabbit Hole Distillery","proof":95,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rabbit Hole Nevallier":                     {"distillery":"Rabbit Hole Distillery","proof":97,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  "Rabbit Hole PX Sherry Cask":               {"distillery":"Rabbit Hole Distillery","proof":99,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── Wilderness Trail ──────────────────────────────────────────────────────
  "Wilderness Trail Bottled in Bond Wheated":  {"distillery":"Wilderness Trail Distillery","proof":100,"age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Wheated Bourbon"},
  "Wilderness Trail Settlers Select Rye":      {"distillery":"Wilderness Trail Distillery","proof":100,"age":"4 Year","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  # ── Castle & Key ──────────────────────────────────────────────────────────
  "Castle & Key Restoration Rye":              {"distillery":"Castle & Key Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Rye"},
  "Castle & Key Small Batch Bourbon":          {"distillery":"Castle & Key Distillery","proof":96,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Kentucky","type":"Bourbon"},
  # ── FEW Spirits ───────────────────────────────────────────────────────────
  "FEW Bourbon":                               {"distillery":"FEW Spirits","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Illinois","type":"Bourbon"},
  "FEW Rye":                                   {"distillery":"FEW Spirits","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Illinois","type":"Rye"},
  # ── Breckenridge ──────────────────────────────────────────────────────────
  "Breckenridge Port Cask Bourbon":            {"distillery":"Breckenridge Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Colorado","type":"Bourbon"},
  # ── Stranahan's ───────────────────────────────────────────────────────────
  "Stranahan's Diamond Peak":                  {"distillery":"Stranahan's Colorado Whiskey","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Colorado","type":"American Single Malt"},
  "Stranahan's Snowflake":                     {"distillery":"Stranahan's Colorado Whiskey","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Colorado","type":"American Single Malt"},
  "Stranahan's Sherry Cask":                   {"distillery":"Stranahan's Colorado Whiskey","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Colorado","type":"American Single Malt"},
  # ── Balcones ──────────────────────────────────────────────────────────────
  "Balcones Texas Pot Still Bourbon":          {"distillery":"Balcones Distilling","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Balcones True Blue":                        {"distillery":"Balcones Distilling","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"Bourbon"},
  "Balcones Lineage":                          {"distillery":"Balcones Distilling","proof":93,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"American Single Malt"},
  "Balcones Brimstone":                        {"distillery":"Balcones Distilling","proof":106,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Texas","type":"American Whiskey"},
  # ── Smoke Wagon ───────────────────────────────────────────────────────────
  "Smoke Wagon Straight Bourbon":              {"distillery":"Nevada H&C Distilling","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Nevada","type":"Bourbon"},
  "Smoke Wagon Undefeated":                    {"distillery":"Nevada H&C Distilling","proof":121,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Nevada","type":"Bourbon"},
  # ── Jack Daniel's ─────────────────────────────────────────────────────────
  "Jack Daniel's Single Barrel Select":        {"distillery":"Jack Daniel's Distillery","proof":94,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  "Jack Daniel's Single Barrel Barrel Proof":  {"distillery":"Jack Daniel's Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  "Jack Daniel's Sinatra Select":              {"distillery":"Jack Daniel's Distillery","proof":90,"age":"NAS","sizes":["1L"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  "Jack Daniel's Tennessee Whiskey 150th Anniversary":{"distillery":"Jack Daniel's Distillery","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  # ── George Dickel ─────────────────────────────────────────────────────────
  "George Dickel Bottled in Bond":             {"distillery":"George Dickel Distillery","proof":100,"age":"13 Year","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  "George Dickel 15 Year":                     {"distillery":"George Dickel Distillery","proof":90,"age":"15 Year","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  "George Dickel 17 Year":                     {"distillery":"George Dickel Distillery","proof":90,"age":"17 Year","sizes":["750ml"],"origin":"USA","region":"Tennessee","type":"Tennessee Whiskey"},
  # ── Smooth Ambler ─────────────────────────────────────────────────────────
  "Smooth Ambler Old Scout Single Barrel":     {"distillery":"Smooth Ambler Spirits","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"USA","region":"West Virginia","type":"Bourbon"},
  "Smooth Ambler Contradiction":               {"distillery":"Smooth Ambler Spirits","proof":100,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"West Virginia","type":"Bourbon"},
  # ── Laws Whiskey House ────────────────────────────────────────────────────
  "Laws Whiskey House Four Grain":             {"distillery":"Laws Whiskey House","proof":102,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Colorado","type":"Bourbon"},
  # ── Westland ──────────────────────────────────────────────────────────────
  "Westland Sherry Wood":                      {"distillery":"Westland Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Washington","type":"American Single Malt"},
  "Westland Peated":                           {"distillery":"Westland Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Washington","type":"American Single Malt"},
  "Westland Solum":                            {"distillery":"Westland Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"USA","region":"Washington","type":"American Single Malt"},
  # ── Irish ─────────────────────────────────────────────────────────────────
  "Redbreast 12 Year":                         {"distillery":"Midleton Distillery","proof":80,"age":"12 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Redbreast 12 Year Cask Strength":           {"distillery":"Midleton Distillery","proof":"Variable","age":"12 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Redbreast 15 Year":                         {"distillery":"Midleton Distillery","proof":92,"age":"15 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Redbreast 21 Year":                         {"distillery":"Midleton Distillery","proof":92,"age":"21 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Redbreast 27 Year":                         {"distillery":"Midleton Distillery","proof":92,"age":"27 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Green Spot Irish Whiskey":                  {"distillery":"Midleton Distillery","proof":80,"age":"NAS","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Yellow Spot 12 Year":                       {"distillery":"Midleton Distillery","proof":92,"age":"12 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Red Spot 15 Year":                          {"distillery":"Midleton Distillery","proof":92,"age":"15 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Blue Spot 7 Year":                          {"distillery":"Midleton Distillery","proof":92,"age":"7 Year","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Midleton Very Rare":                        {"distillery":"Midleton Distillery","proof":80,"age":"NAS","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  "Midleton Barry Crockett Legacy":            {"distillery":"Midleton Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"Ireland","region":"County Cork","type":"Single Pot Still"},
  # ── Japanese ──────────────────────────────────────────────────────────────
  "Yamazaki 12 Year":                          {"distillery":"Yamazaki Distillery","proof":86,"age":"12 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Yamazaki 18 Year":                          {"distillery":"Yamazaki Distillery","proof":96,"age":"18 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Yamazaki 25 Year":                          {"distillery":"Yamazaki Distillery","proof":96,"age":"25 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Yamazaki Distillers Reserve":               {"distillery":"Yamazaki Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Hakushu 12 Year":                           {"distillery":"Hakushu Distillery","proof":86,"age":"12 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Hakushu 18 Year":                           {"distillery":"Hakushu Distillery","proof":96,"age":"18 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Hakushu Distillers Reserve":                {"distillery":"Hakushu Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Hibiki 17 Year":                            {"distillery":"Suntory","proof":86,"age":"17 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Hibiki 21 Year":                            {"distillery":"Suntory","proof":86,"age":"21 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Hibiki 30 Year":                            {"distillery":"Suntory","proof":86,"age":"30 Year","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Hibiki Japanese Harmony":                   {"distillery":"Suntory","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Hibiki Blenders Choice":                    {"distillery":"Suntory","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Nikka From the Barrel":                     {"distillery":"Nikka Whisky","proof":102.8,"age":"NAS","sizes":["500ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Nikka Coffey Grain":                        {"distillery":"Nikka Whisky","proof":90,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Nikka Coffey Malt":                         {"distillery":"Nikka Whisky","proof":90,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Blended"},
  "Yoichi Single Malt":                        {"distillery":"Nikka Whisky","proof":90,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  "Miyagikyo Single Malt":                     {"distillery":"Nikka Whisky","proof":90,"age":"NAS","sizes":["750ml"],"origin":"Japan","region":"Japan","type":"Japanese Single Malt"},
  # ── Taiwan ────────────────────────────────────────────────────────────────
  "Kavalan Solist Vinho Barrique":             {"distillery":"Kavalan Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"Taiwan","region":"Yilan County","type":"Single Malt"},
  "Kavalan Solist ex-Bourbon":                 {"distillery":"Kavalan Distillery","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"Taiwan","region":"Yilan County","type":"Single Malt"},
  "Kavalan King Car Conductor":                {"distillery":"Kavalan Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Taiwan","region":"Yilan County","type":"Single Malt"},
  # ── Scotch ────────────────────────────────────────────────────────────────
  "The Macallan 12 Year Sherry Oak":           {"distillery":"The Macallan","proof":86,"age":"12 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Macallan 18 Year Sherry Oak":           {"distillery":"The Macallan","proof":86,"age":"18 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Macallan 25 Year":                      {"distillery":"The Macallan","proof":86,"age":"25 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Macallan Rare Cask":                    {"distillery":"The Macallan","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Macallan Edition Series":               {"distillery":"The Macallan","proof":82,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Glenfiddich 21 Year Gran Reserva":          {"distillery":"Glenfiddich Distillery","proof":80,"age":"21 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Glenfiddich 26 Year Excellence":            {"distillery":"Glenfiddich Distillery","proof":85.6,"age":"26 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Glenfiddich Grand Yozakura":                {"distillery":"Glenfiddich Distillery","proof":86,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Balvenie 21 Year PortWood":             {"distillery":"The Balvenie Distillery","proof":80,"age":"21 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Balvenie 25 Year":                      {"distillery":"The Balvenie Distillery","proof":84.2,"age":"25 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Balvenie 30 Year":                      {"distillery":"The Balvenie Distillery","proof":80,"age":"30 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "The Balvenie Caribbean Cask 14 Year":       {"distillery":"The Balvenie Distillery","proof":86,"age":"14 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Springbank 10 Year":                        {"distillery":"Springbank Distillery","proof":92,"age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Campbeltown","type":"Single Malt Scotch"},
  "Springbank 12 Year":                        {"distillery":"Springbank Distillery","proof":92,"age":"12 Year","sizes":["750ml"],"origin":"Scotland","region":"Campbeltown","type":"Single Malt Scotch"},
  "Springbank 15 Year":                        {"distillery":"Springbank Distillery","proof":92,"age":"15 Year","sizes":["750ml"],"origin":"Scotland","region":"Campbeltown","type":"Single Malt Scotch"},
  "Springbank 21 Year":                        {"distillery":"Springbank Distillery","proof":92,"age":"21 Year","sizes":["750ml"],"origin":"Scotland","region":"Campbeltown","type":"Single Malt Scotch"},
  "Longrow Red":                               {"distillery":"Springbank Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"Scotland","region":"Campbeltown","type":"Single Malt Scotch"},
  "Ardbeg 10 Year":                            {"distillery":"Ardbeg Distillery","proof":92,"age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Ardbeg Uigeadail":                          {"distillery":"Ardbeg Distillery","proof":108.2,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Ardbeg Corryvreckan":                       {"distillery":"Ardbeg Distillery","proof":114.2,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Ardbeg Traigh Bhan 19 Year":                {"distillery":"Ardbeg Distillery","proof":92,"age":"19 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Ardbeg Blaaack":                            {"distillery":"Ardbeg Distillery","proof":92,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Ardbeg AN OA":                              {"distillery":"Ardbeg Distillery","proof":92.6,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Lagavulin 16 Year":                         {"distillery":"Lagavulin Distillery","proof":86,"age":"16 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Lagavulin 8 Year":                          {"distillery":"Lagavulin Distillery","proof":96,"age":"8 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Lagavulin 12 Year Cask Strength":           {"distillery":"Lagavulin Distillery","proof":"Variable","age":"12 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Laphroaig 10 Year":                         {"distillery":"Laphroaig Distillery","proof":86,"age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Laphroaig 10 Year Cask Strength":           {"distillery":"Laphroaig Distillery","proof":"Variable","age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Laphroaig Quarter Cask":                    {"distillery":"Laphroaig Distillery","proof":96,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Laphroaig 18 Year":                         {"distillery":"Laphroaig Distillery","proof":96,"age":"18 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Highland Park 18 Year Viking Pride":        {"distillery":"Highland Park Distillery","proof":86,"age":"18 Year","sizes":["750ml"],"origin":"Scotland","region":"Islands","type":"Single Malt Scotch"},
  "Highland Park 25 Year":                     {"distillery":"Highland Park Distillery","proof":99.2,"age":"25 Year","sizes":["750ml"],"origin":"Scotland","region":"Islands","type":"Single Malt Scotch"},
  "GlenDronach 18 Year Allardice":             {"distillery":"The GlenDronach Distillery","proof":92,"age":"18 Year","sizes":["750ml"],"origin":"Scotland","region":"Highlands","type":"Single Malt Scotch"},
  "GlenDronach 21 Year Parliament":            {"distillery":"The GlenDronach Distillery","proof":92,"age":"21 Year","sizes":["750ml"],"origin":"Scotland","region":"Highlands","type":"Single Malt Scotch"},
  "GlenAllachie 10 Year Cask Strength":        {"distillery":"The GlenAllachie Distillery","proof":"Variable","age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "GlenAllachie 12 Year":                      {"distillery":"The GlenAllachie Distillery","proof":92,"age":"12 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "GlenAllachie 15 Year":                      {"distillery":"The GlenAllachie Distillery","proof":92,"age":"15 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Bruichladdich Octomore":                    {"distillery":"Bruichladdich Distillery","proof":"Variable","age":"Varies","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Bruichladdich Port Charlotte":              {"distillery":"Bruichladdich Distillery","proof":100,"age":"10 Year","sizes":["750ml"],"origin":"Scotland","region":"Islay","type":"Single Malt Scotch"},
  "Talisker 18 Year":                          {"distillery":"Talisker Distillery","proof":91.4,"age":"18 Year","sizes":["750ml"],"origin":"Scotland","region":"Islands","type":"Single Malt Scotch"},
  "Talisker 25 Year":                          {"distillery":"Talisker Distillery","proof":91.4,"age":"25 Year","sizes":["750ml"],"origin":"Scotland","region":"Islands","type":"Single Malt Scotch"},
  "Glenfarclas 21 Year":                       {"distillery":"Glenfarclas Distillery","proof":86,"age":"21 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Glenfarclas 25 Year":                       {"distillery":"Glenfarclas Distillery","proof":86,"age":"25 Year","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  "Glenfarclas 105":                           {"distillery":"Glenfarclas Distillery","proof":105,"age":"NAS","sizes":["750ml"],"origin":"Scotland","region":"Speyside","type":"Single Malt Scotch"},
  # ── India ─────────────────────────────────────────────────────────────────
  "Amrut Fusion":                              {"distillery":"Amrut Distilleries","proof":100,"age":"NAS","sizes":["750ml"],"origin":"India","region":"Karnataka","type":"Single Malt"},
  "Amrut Intermediate Sherry":                 {"distillery":"Amrut Distilleries","proof":115.2,"age":"NAS","sizes":["750ml"],"origin":"India","region":"Karnataka","type":"Single Malt"},
  "Paul John Mithuna":                         {"distillery":"John Distilleries","proof":"Variable","age":"NAS","sizes":["750ml"],"origin":"India","region":"Goa","type":"Single Malt"},
  "Paul John Bold":                            {"distillery":"John Distilleries","proof":93.8,"age":"NAS","sizes":["750ml"],"origin":"India","region":"Goa","type":"Single Malt"},
  "Paul John Christmas Edition":               {"distillery":"John Distilleries","proof":98.6,"age":"NAS","sizes":["750ml"],"origin":"India","region":"Goa","type":"Single Malt"},
}

FIELDS = ["distillery","proof","age","sizes","origin","region","type"]

def main():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    missing = []
    for entry in data:
        name = entry["name"]
        meta = METADATA.get(name)
        if meta:
            for field in FIELDS:
                entry[field] = meta[field]
        else:
            missing.append(name)

    if missing:
        print(f"WARNING: No metadata for {len(missing)} entries:", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)

    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Done. Updated {len(data) - len(missing)}/{len(data)} entries.")

if __name__ == "__main__":
    main()
