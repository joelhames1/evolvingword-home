// Which worlds have a globe on the chooser, in this order. Change this list to
// show or hide a world; hidden worlds still work by link (?world=<id>), and
// ?worlds=all shows every globe, for looking at ones you've hidden.
//
// The owner page (/owner.html) can override this list live, without a deploy;
// this list is what shows when it hasn't, or when it can't be reached.
//
// The chooser is laid out for up to five globes; three is the sweet spot.
import type { WorldId } from '.';

export const SHOWN: WorldId[] = ['greenhouse', 'train', 'library', 'heavens'];
