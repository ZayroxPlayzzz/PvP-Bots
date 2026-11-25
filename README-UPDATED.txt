UPDATED COMBAT + KIT NOTES

Bot changes:
- Attempts to equip the best sword in inventory before player or mob combat.
- Uses the PvP pathing controller to chase/attack nearby hostile mobs.
- Eats inventory food when hunger is low; uses a golden apple (enchanted golden apple preferred) when health is low.
- Existing attack-on-sight player targeting and excluded-name list are retained.

Kit Skript:
- scripts/ScarletBot_Loadout.sk contains /sm27 for ShadowMiner27 and MsKingMaster.
- Gives netherite armor, sword/axe, bow/arrows, shield, totems, food, golden apples, enchanted golden apples and pearls.
- Applies Protection IV, Unbreaking III, Mending I to armor; boots also Feather Falling IV; Sharpness V, Unbreaking III, Mending I to sword and axe.
- Install into plugins/Skript/scripts/ then run /sk reload ScarletBot_Loadout.

Check settings.json for server address, account, and auth values before starting. JavaScript syntax check passed. Not live-tested on the Minecraft server; Skript syntax/behavior depends on installed Skript version and server plugins.
