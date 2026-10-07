/**
 * The realm functions a client may call. server/schema.sql grants exactly these to the public
 * roles (rpc.test.mjs checks the two lists agree); everything else is internal.
 */
export const REALM_API = [
  "vm_register", "vm_profile", "vm_create_character", "vm_import_character", "vm_delete_character", "vm_character",
  "vm_create_world", "vm_join", "vm_enter", "vm_heartbeat", "vm_leave", "vm_gather", "vm_craft", "vm_equip", "vm_use", "vm_trade",
  "vm_loot", "vm_world_flag", "vm_char_flag", "vm_member_flag", "vm_boss_hit", "vm_boss_reset", "vm_died",
  "vm_leave_world", "vm_kick", "vm_rest", "vm_delete_world",
];
