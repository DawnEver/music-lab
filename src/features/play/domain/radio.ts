/**
 * Moving through a one-of-N group with the arrow keys.
 *
 * A segmented control is a radio group with every option visible, and a
 * radio group is how it is meant to be moved through: the arrows, wrapping
 * at the ends, because a player who has reached the end of two or three
 * options means the first one rather than nothing.
 *
 * It is a function of the key and the position and nothing else, which is
 * why it is here and not in the components that ask: play has one group
 * for the direction the instrument runs and one for how it is sounded, and
 * they were the same six lines twice.
 */
export function ringStep(key: string, index: number, length: number): number | null {
  const step =
    key === "ArrowRight" || key === "ArrowDown" ? 1
    : key === "ArrowLeft" || key === "ArrowUp" ? -1
    : 0;
  if (step === 0 || length <= 0) return null;
  return (index + step + length) % length;
}
