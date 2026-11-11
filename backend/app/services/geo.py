"""Ближайшая улица к точке (равнопромежуточная проекция — достаточно для масштаба села)."""
import math

R = 6371000.0


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    s = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(s))


def distance_to_segment(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    k = math.cos(math.radians(p[0]))
    px, py = p[1] * k, p[0]
    ax, ay = a[1] * k, a[0]
    bx, by = b[1] * k, b[0]
    dx, dy = bx - ax, by - ay
    len2 = dx * dx + dy * dy
    t = 0.0 if len2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
    return distance_m(p, (ay + t * dy, (ax + t * dx) / k))


def distance_to_line(p: tuple[float, float], line: list[list[float]]) -> float:
    if len(line) == 1:
        return distance_m(p, (line[0][0], line[0][1]))
    return min(distance_to_segment(p, (line[i][0], line[i][1]), (line[i + 1][0], line[i + 1][1]))
               for i in range(len(line) - 1))


def nearest(p: tuple[float, float], lines: dict[str, list[list[float]]], max_m: float = 600) -> str | None:
    best: tuple[str, float] | None = None
    for key, line in lines.items():
        if not line:
            continue
        d = distance_to_line(p, line)
        if best is None or d < best[1]:
            best = (key, d)
    return best[0] if best and best[1] <= max_m else None
