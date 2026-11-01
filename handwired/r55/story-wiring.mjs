/* r55-story wiring around the approved handwired circuits.
 *
 * The kernel in ./story-circuits.mjs is copied byte-for-byte from
 * game/dist/handwired/r55/story-circuits.mjs.  This file only adds the
 * story-specific meaning of its inputs/outputs:
 *
 *   elevator span=12  -> 3F .. 15F (twelve storeys), display = from + floors
 *   door     progress -> the sheet-metal leaf angle and its nav barrier
 *   cue      time     -> active keyframe index / u / eased u for shot timelines
 *
 * Nothing here re-implements the kernel.  Every numeric answer is delegated
 * to native functions or to a verified weight engine created by
 * createStoryCircuits/loadStoryCircuits.
 */
import {
  CUE, DOOR, ELEVATOR, createStoryCircuits, cueTable, elevatorTimes,
  loadStoryCircuits, nativeCue, nativeDoor, nativeElevator, smooth
} from './story-circuits.mjs';

export { createStoryCircuits, loadStoryCircuits };

export const STORY_ELEVATOR = Object.freeze({ fromFloor: 3, toFloor: 15, span: 12 });
export const STORY_DOOR = Object.freeze({ width: DOOR.leaf, hinge: 'left', inwardSign: -1 });

const isInt = (value) => Number.isInteger(value);
function requireSpan(span) {
  if (!isInt(span) || span < ELEVATOR.minSpan || span > ELEVATOR.maxSpan) throw Error(`r55 story: invalid elevator span ${span}`);
  return span;
}
function requireFrom(from) {
  if (!isInt(from) || from < 1 || from > 100) throw Error(`r55 story: invalid origin floor ${from}`);
  return from;
}

/** Floor number shown once the cabin has travelled `state.floors` storeys. */
export function displayFloor(state, from = STORY_ELEVATOR.fromFloor) {
  requireFrom(from);
  if (!state || !isInt(state.floors)) throw Error('r55 story: elevator state with integer floors required');
  return from + state.floors;
}

/** "▲15" while travelling, "15" once the cabin has stopped. */
export function displayText(state, from = STORY_ELEVATOR.fromFloor) {
  const floor = displayFloor(state, from);
  if (floor > 99) throw Error(`r55 story: display floor out of range ${floor}`);
  return `${state.arrow ? '▲' : ''}${String(floor).padStart(2, '0')}`;
}

/** Signed x offset of a cabin door leaf from its closed position. */
export function cabinDoorOffset(doors, { closed = 0.34, travel = 0.7 } = {}) {
  if (!Number.isFinite(doors) || doors < 0 || doors > 1) throw Error(`r55 story: invalid door opening ${doors}`);
  if (!Number.isFinite(closed) || !Number.isFinite(travel)) throw Error('r55 story: invalid door geometry');
  return closed + travel * doors;
}

/** Door leaf angle and nav barrier from the kernel's door circuit. */
export function doorAt(circuits, progress, ax, az, radius) {
  if (typeof circuits?.door !== 'function') throw Error('r55 story: door circuit required');
  return circuits.door(progress, ax, az, radius);
}

/** Keyframe lookup from the kernel's cue circuit. */
export function cueAt(circuits, time, times) {
  if (typeof circuits?.cue !== 'function') throw Error('r55 story: cue circuit required');
  return circuits.cue(time, cueTable(times));
}

/** Sorted, validated key times from a setup timeline (or screenKeys). */
export function timelineTimes(entries, field = 't') {
  if (!Array.isArray(entries) || !entries.length) throw Error('r55 story: timeline entries required');
  const times = entries.map((entry, index) => {
    const value = entry?.[field];
    if (!Number.isFinite(value)) throw Error(`r55 story: timeline entry ${index} has no finite ${field}`);
    return value;
  });
  const sorted = [...times].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) if (sorted[i] <= sorted[i - 1]) throw Error('r55 story: duplicate timeline times are not allowed');
  if (sorted[0] < CUE.tMin || sorted.at(-1) > CUE.tMax) throw Error('r55 story: timeline time outside cue domain');
  return sorted;
}

/** Elevator cycle with the story's display convention attached. */
export function elevatorAt(circuits, elapsed, { from = STORY_ELEVATOR.fromFloor, span = STORY_ELEVATOR.span } = {}) {
  requireSpan(span);
  requireFrom(from);
  if (typeof circuits?.elevator !== 'function') throw Error('r55 story: elevator circuit required');
  const state = circuits.elevator(elapsed, span);
  return { ...state, display: displayFloor(state, from), text: displayText(state, from), span, from };
}

/** Travel breakpoints for the story span, in seconds since the call. */
export function storyElevatorTimes(span = STORY_ELEVATOR.span) {
  return elevatorTimes(requireSpan(span));
}

/** Deterministic idle/rest sample from the kernel's native reference. */
export function restElevator({ from = STORY_ELEVATOR.fromFloor, span = STORY_ELEVATOR.span } = {}) {
  requireSpan(span);
  requireFrom(from);
  const state = nativeElevator(-1, span);
  return { ...state, display: displayFloor(state, from), text: displayText(state, from), span, from };
}

/** Deterministic closed-door sample from the kernel's native reference. */
export function closedDoor(progress = 0, ax = 4, az = 4, radius = 0) {
  return nativeDoor(progress, ax, az, radius);
}

/** Native cue reference for diagnostics and tests. */
export function nativeCueAt(time, times) {
  return nativeCue(time, cueTable(times));
}

export { ELEVATOR, DOOR, CUE, smooth };
