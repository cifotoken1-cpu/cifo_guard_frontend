-- crossing_events: virtual line crossing data from Python vision worker
CREATE TABLE IF NOT EXISTS crossing_events (
  id           VARCHAR(36)  NOT NULL,
  camera_id    VARCHAR(50)  NOT NULL,
  direction    ENUM('in','out') NOT NULL,
  crossed_at   DATETIME     NOT NULL,
  metadata     JSON         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_crossing_camera
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_ce_camera_id      (camera_id),
  INDEX idx_ce_direction      (direction),
  INDEX idx_ce_crossed_at     (crossed_at),
  INDEX idx_ce_camera_date    (camera_id, crossed_at),
  INDEX idx_ce_camera_dir_date (camera_id, direction, crossed_at)
);
