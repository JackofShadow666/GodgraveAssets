# Правила для `src/combat`

- Начинай с конкретного файла оружия или типа боя, а не со всего combat-пакета.
- Для melee-проблем сначала смотри `combat.js`.
- Для projectile, wand, crossbow и ranged bot behavior сначала смотри `ranged.js`.
- Для equip/drop/throw и weapon traits сначала смотри `weapons.js`.
- Для local PvP таргетинга и friendly-fire всегда перепроверяй `factions.js`.
- После локальной правки проверь вызовы из `src/main.js`, а не весь проект.
- Если проблема проявляется только онлайн, дополнительно открой `src/network/net.js`.
