const SLOT = /<<([a-zA-Z0-9_]+)>>/g;

/** Replace `<<slotName>>` placeholders in a skeleton with TS source fragments. */
export function compose(skeleton: string, slots: Record<string, string>): string {
    const missing = new Set<string>();
    const out = skeleton.replace(SLOT, (_, name: string) => {
        const value = slots[name];
        if (value === undefined) {
            missing.add(name);
            return `/* MISSING SLOT: ${name} */`;
        }
        return value;
    });
    if (missing.size > 0) {
        throw new Error(`compose: missing slots: ${[...missing].join(', ')}`);
    }
    return out;
}
