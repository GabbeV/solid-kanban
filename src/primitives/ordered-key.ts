// ASCII order matches digit order, so complete positions sort with < and >.
export const orderDigits =
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

export function compareKeys(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function validOrderKey(key: string) {
  return /^[-\w]+$/.test(key) && !key.endsWith(orderDigits[0]);
}

// The ID suffix is implicit: only the position prefix needs to be stored.
// Equal prefixes still have distinct positions, with room to insert between.
export function positionKey(prefix: string, id: string) {
  let suffix = "";
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  ) {
    // A UUID occupies 22 digits. Pad its four spare bits on the right.
    let bits = BigInt("0x" + id.replaceAll("-", "")) << 4n;
    for (let i = 0; i < 22; i++) {
      suffix = orderDigits[Number(bits & 63n)] + suffix;
      bits >>= 6n;
    }
    suffix += orderDigits[1];
  } else {
    // Other IDs use three digits per UTF-16 code unit. A trailing length
    // distinguishes suffixes of different widths; the final digit
    // distinguishes these IDs from UUIDs and keeps every position nonzero.
    if (id.length >= 4096) throw new Error("Invalid ID.");
    for (let i = 0; i < id.length; i++) {
      const unit = id.charCodeAt(i);
      suffix +=
        orderDigits[unit >> 12] +
        orderDigits[(unit >> 6) & 63] +
        orderDigits[unit & 63];
    }
    suffix +=
      orderDigits[id.length >> 6] +
      orderDigits[id.length & 63] +
      orderDigits[2];
  }
  return prefix + suffix;
}

// Exact base-64 fractions in (0, 1). Pick a prefix whose entire suffix
// interval lies inside the gap, leaving room for any item's implicit ID.
// Tight gaps need more digits, without floats or renumbering other items.
export function keyBetween(
  left: string | undefined,
  right: string | undefined,
) {
  if (
    (left !== undefined && !validOrderKey(left)) ||
    (right !== undefined && !validOrderKey(right)) ||
    (left !== undefined && right !== undefined && left >= right)
  )
    throw new Error("Invalid order bounds.");
  let prefix = "";
  for (let i = 0; ; i++) {
    const low = orderDigits.indexOf(left?.[i] ?? orderDigits[0]);
    const high =
      right === undefined
        ? orderDigits.length
        : orderDigits.indexOf(right[i] ?? orderDigits[0]);
    if (high - low > 1)
      return prefix + orderDigits[Math.floor((low + high) / 2)];
    prefix += orderDigits[low];
    // Choosing a smaller digit leaves every extension below the upper bound.
    if (low < high) right = undefined;
  }
}
