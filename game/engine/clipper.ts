export function clipPolygonToRect(polygon: {x: number, y: number}[], minX: number, minY: number, maxX: number, maxY: number): {x: number, y: number}[] {
    let output = polygon;

    // Clip against left edge (x >= minX)
    let input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i - 1 + input.length) % input.length];
        const curInside = cur.x >= minX;
        const prevInside = prev.x >= minX;

        if (curInside !== prevInside) {
            const t = (minX - prev.x) / (cur.x - prev.x);
            output.push({ x: minX, y: prev.y + t * (cur.y - prev.y) });
        }
        if (curInside) {
            output.push(cur);
        }
    }
    if (output.length === 0) return [];

    // Clip against right edge (x <= maxX)
    input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i - 1 + input.length) % input.length];
        const curInside = cur.x <= maxX;
        const prevInside = prev.x <= maxX;

        if (curInside !== prevInside) {
            const t = (maxX - prev.x) / (cur.x - prev.x);
            output.push({ x: maxX, y: prev.y + t * (cur.y - prev.y) });
        }
        if (curInside) {
            output.push(cur);
        }
    }
    if (output.length === 0) return [];

    // Clip against top edge (y >= minY)
    input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i - 1 + input.length) % input.length];
        const curInside = cur.y >= minY;
        const prevInside = prev.y >= minY;

        if (curInside !== prevInside) {
            const t = (minY - prev.y) / (cur.y - prev.y);
            output.push({ x: prev.x + t * (cur.x - prev.x), y: minY });
        }
        if (curInside) {
            output.push(cur);
        }
    }
    if (output.length === 0) return [];

    // Clip against bottom edge (y <= maxY)
    input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i - 1 + input.length) % input.length];
        const curInside = cur.y <= maxY;
        const prevInside = prev.y <= maxY;

        if (curInside !== prevInside) {
            const t = (maxY - prev.y) / (cur.y - prev.y);
            output.push({ x: prev.x + t * (cur.x - prev.x), y: maxY });
        }
        if (curInside) {
            output.push(cur);
        }
    }

    return output;
}

export function createCirclePolygon(cx: number, cy: number, radius: number, segments: number = 64): {x: number, y: number}[] {
    const poly = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        poly.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius
        });
    }
    return poly;
}
