/**
 * Поставщик данных Музея (067 Т11, 067-Р1 в): пока источников нет — пусто, полки показывают «0 из 4» и силуэты кубков.
 * Ролики, Кубок двора и газеты вносит 068 Т7; экран и вид полок (`engine/museum`) от этого не меняются.
 */
import type { MuseumData } from '../../engine/museum';

export const providedMuseum = (): MuseumData => ({ videos: 0, cupWon: false });
