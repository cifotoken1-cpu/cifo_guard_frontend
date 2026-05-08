import { useIncidentDetail, useUpdateIncidentStatus } from '../../hooks/useIncidents';
import { IncidentTimeline } from './IncidentTimeline';
import styles from './incident-response.module.css';

const PRI_BADGE = {
  HIGH: 'badgeRed',
  CRITICAL: 'badgeRed',
  MEDIUM: 'badgeAmber',
  LOW: 'badgeCyan',
};

const PRI_LABEL = { HIGH: 'TINGGI', CRITICAL: 'KRITIS', MEDIUM: 'SEDANG', LOW: 'RENDAH' };

const TYPE_LABEL = {
  THEFT: 'Pencurian',
  FIRE: 'Kebakaran/Asap',
  SUSPICIOUS: 'Mencurigakan',
  VEHICLE: 'Kendaraan',
  MAINTENANCE: 'Pemeliharaan',
  MEDICAL: 'Medis',
  OTHER: 'Lainnya',
};

export function IncidentDetailPane({ incident }) {
  const { data: detail } = useIncidentDetail(incident?.id);
  const updateMutation = useUpdateIncidentStatus();

  if (!incident) {
    return (
      <div className={styles.detailPane}>
        <div className={styles.empty} style={{ paddingTop: '4rem' }}>
          Pilih insiden untuk melihat detail.
        </div>
      </div>
    );
  }

  const inc = detail ?? incident;
  const activities = inc.activities ?? inc.Activities ?? [];
  const pri = (inc.priority || '').toUpperCase();
  const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';

  return (
    <div className={styles.detailPane}>
      <div className={styles.detailTop}>
        <div className={styles.detailId}>{inc.incidentNumber || inc.id}</div>
        <div className={styles.detailTitle}>{inc.title}</div>
        <div className={styles.detailMeta}>
          <span className={`${styles.badge} ${styles[PRI_BADGE[pri]] || styles.badgeGray}`}>
            {PRI_LABEL[pri] || pri}
          </span>
          <span className={`${styles.badge} ${styles.badgeCyan}`}>{inc.status}</span>
          <span className={`${styles.badge} ${styles.badgeGray}`}>
            {TYPE_LABEL[(inc.type || '').toUpperCase()] || inc.type}
          </span>
        </div>
      </div>

      <div className={styles.detailBody}>
        <div>
          <div className={styles.sectionTitle}>Detail</div>
          <div className={styles.detailGrid}>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Lokasi</div>
              <div className={styles.fieldVal}>{inc.location?.name || '—'}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Pelapor</div>
              <div className={styles.fieldVal}>
                {inc.reporter?.name || inc.reportedBy || '—'}
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Petugas</div>
              <div className={styles.fieldVal}>
                {inc.assignedMember?.name || inc.assignedTo || 'Belum ditugaskan'}
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Dibuat</div>
              <div className={styles.fieldVal}>
                {new Date(inc.createdAt).toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        {inc.description && (
          <div className={styles.field}>
            <div className={styles.fieldLbl}>Deskripsi</div>
            <div className={styles.fieldVal} style={{ lineHeight: 1.5 }}>{inc.description}</div>
          </div>
        )}

        <div>
          <div className={styles.sectionTitle}>Riwayat Aktivitas</div>
          <IncidentTimeline activities={activities} />
        </div>
      </div>

      <div className={styles.detailActions}>
        <button
          className={styles.resolveBtn}
          onClick={() => updateMutation.mutate({ id: inc.id, status: 'RESOLVED' })}
          disabled={isResolved || updateMutation.isPending}
        >
          {isResolved
            ? '✓ Insiden Selesai'
            : updateMutation.isPending
            ? 'Memproses...'
            : 'Tandai Selesai'}
        </button>
      </div>
    </div>
  );
}
