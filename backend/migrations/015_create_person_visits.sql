-- person_visits: Re-ID tracking per individual (S6)
CREATE TABLE IF NOT EXISTS person_visits (
  id               VARCHAR(36)  NOT NULL,
  camera_id        VARCHAR(50)  NOT NULL,
  person_uid       VARCHAR(100) NOT NULL,
  entry_time       DATETIME     NOT NULL,
  exit_time        DATETIME     NULL,
  duration_seconds INT          NULL,
  confidence       FLOAT        NULL,
  match_method     VARCHAR(30)  NULL,
  metadata         JSON         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_visit_camera
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_pv_camera_id    (camera_id),
  INDEX idx_pv_person_uid   (person_uid),
  INDEX idx_pv_entry_time   (entry_time),
  INDEX idx_pv_exit_time    (exit_time),
  INDEX idx_pv_camera_entry (camera_id, entry_time)
);
