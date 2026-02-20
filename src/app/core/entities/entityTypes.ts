export type EntityId = string;

export type WallAttachment = {
  // segment i -> i+1 (wraps) on the room inner loop
  wallSegIndex: number;
  // 0..1 parameter along segment (start->end)
  t: number;
  // perpendicular distance from wall centerline (mm). Positive is "to the left" of segment direction.
  offsetFromWallMm?: number;
};

export type EntityBase = {
  id: EntityId;
  kind: string;
};

export type WindowStyle = "single-leaf" | "double-leaf" | "fixed" | "sliding";
export type DoorStyle = "single-leaf" | "double-leaf" | "sliding" | "pocket";
export type DoorLeafSide = "left" | "right";
export type DoorSwingDirection = "inside" | "outside";

export type WallOpeningEntity = EntityBase & {
  kind: "wall-opening";
  attach: WallAttachment;
  openingType: "door" | "window";
  widthMm: number;
  heightMm: number;
  sillHeightMm?: number;
  windowStyle?: WindowStyle;
  doorStyle?: DoorStyle;
  doorLeafSide?: DoorLeafSide;
  doorSwingDirection?: DoorSwingDirection;
};

export type FixtureEntity = EntityBase & {
  kind: "fixture";
  attach: WallAttachment;
  fixtureType: "wc" | "vanity" | "shower" | "custom";
  widthMm: number;
  depthMm: number;
  rotationDeg?: number;
};

export type Entity = WallOpeningEntity | FixtureEntity;

export type EntityMap = Record<EntityId, Entity>;
