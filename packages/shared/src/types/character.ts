import type { Game } from "./item.js";

/** PoE1 ascendancy classes */
export type Poe1Class =
  | "Marauder"
  | "Juggernaut"
  | "Berserker"
  | "Chieftain"
  | "Ranger"
  | "Deadeye"
  | "Raider"
  | "Pathfinder"
  | "Witch"
  | "Necromancer"
  | "Elementalist"
  | "Occultist"
  | "Duelist"
  | "Slayer"
  | "Gladiator"
  | "Champion"
  | "Templar"
  | "Inquisitor"
  | "Hierophant"
  | "Guardian"
  | "Shadow"
  | "Assassin"
  | "Trickster"
  | "Saboteur"
  | "Scion"
  | "Ascendant";

/** PoE2 classes and ascendancies */
export type Poe2Class =
  | "Warrior"
  | "Titan"
  | "Warbringer"
  | "Smith of Kitava"
  | "Mercenary"
  | "Witch Hunter"
  | "Gemling Legionnaire"
  | "Tactician"
  | "Ranger"
  | "Deadeye"
  | "Pathfinder"
  | "Sorceress"
  | "Stormweaver"
  | "Chronomancer"
  | "Disciple of Varashta"
  | "Witch"
  | "Infernalist"
  | "Blood Mage"
  | "Lich"
  | "Monk"
  | "Invoker"
  | "Acolyte of Chayula"
  | "Huntress"
  | "Amazon"
  | "Ritualist"
  | "Druid"
  | "Oracle"
  | "Shaman";

/** A character from the GGG API */
export interface Character {
  game: Game;
  name: string;
  class: Poe1Class | Poe2Class;
  level: number;
  experience: number;
  league: string;
  lastActive: string | null;
}

/** League information */
export interface League {
  id: string;
  realm: string;
  startAt: string;
  endAt: string | null;
  url: string;
}
