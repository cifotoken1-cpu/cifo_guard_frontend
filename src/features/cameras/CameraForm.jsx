import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi } from '../../api/cameras.api';
import { buildCameraPostBody } from '../../services/camera.service';
import styles from './CameraForm.module.css';

/**
 * Camera CRUD Form — Tambah/Edit kamera
 * 
 * Features:
 * - Add new camera (POST with dual-field workaround)
 * - Edit existing camera (PUT)
 * - Delete camera (DELETE)
 * - Field validation
 * - React Query integration
 */
export function CameraForm({ camera = null, onClose = () => {} }) {
  const qc = useQueryClient();
  const isEdit = !!camera?.id;

  // Form state
  const [form, setForm] = useState({
    id: camera?.id || '',
    name: camera?.name || '',
    label: camera?.label || camera?.name || '',
    area: camera?.area || '',
    lat: camera?.lat || '',
    lng: camera?.lng || '',
    streamUrl: camera?.streamUrl || camera?.stream_url || '',
    res: camera?.res || camera?.resolution || '1080p',
  });

  const [errors, setErrors] = useState({});

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (body) => {
      const payload = buildCameraPostBody(body);
      return camerasApi.db.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] });
      onClose();
    },
    onError: (err) => {
      setErrors({ submit: err.response?.data?.message || err.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (body) => {
      return camerasApi.db.update(camera.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] });
      onClose();
    },
    onError: (err) => {
      setErrors({ submit: err.response?.data?.message || err.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return camerasApi.db.delete(camera.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] });
      onClose();
    },
    onError: (err) => {
      setErrors({ submit: err.response?.data?.message || err.message });
    },
  });

  // Validate form
  const validate = () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'Name required';
    if (!form.label?.trim()) errs.label = 'Label required';
    if (form.lat && isNaN(parseFloat(form.lat))) errs.lat = 'Invalid latitude';
    if (form.lng && isNaN(parseFloat(form.lng))) errs.lng = 'Invalid longitude';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  // Handle delete with confirmation
  const handleDelete = () => {
    if (window.confirm(`Delete "${form.name}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3>{isEdit ? 'Edit Camera' : 'Add New Camera'}</h3>

      {/* Error message */}
      {errors.submit && <div className={styles.error}>{errors.submit}</div>}

      {/* Form fields — 2 columns */}
      <div className={styles.grid}>
        {/* Name */}
        <div className={styles.field}>
          <label>Name *</label>
          <input
            type="text"
            placeholder="e.g. Driveway Camera"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={isLoading}
          />
          {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
        </div>

        {/* Label */}
        <div className={styles.field}>
          <label>Label *</label>
          <input
            type="text"
            placeholder="e.g. CAM-01"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            disabled={isLoading}
          />
          {errors.label && <span className={styles.fieldError}>{errors.label}</span>}
        </div>

        {/* Area */}
        <div className={styles.field}>
          <label>Area / Location</label>
          <input
            type="text"
            placeholder="e.g. Front Door"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            disabled={isLoading}
          />
        </div>

        {/* Resolution */}
        <div className={styles.field}>
          <label>Resolution</label>
          <select
            value={form.res}
            onChange={(e) => setForm({ ...form, res: e.target.value })}
            disabled={isLoading}
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>

        {/* Latitude */}
        <div className={styles.field}>
          <label>Latitude</label>
          <input
            type="number"
            placeholder="e.g. 40.7128"
            step="0.0001"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            disabled={isLoading}
          />
          {errors.lat && <span className={styles.fieldError}>{errors.lat}</span>}
        </div>

        {/* Longitude */}
        <div className={styles.field}>
          <label>Longitude</label>
          <input
            type="number"
            placeholder="e.g. -74.0060"
            step="0.0001"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            disabled={isLoading}
          />
          {errors.lng && <span className={styles.fieldError}>{errors.lng}</span>}
        </div>

        {/* Stream URL — full width */}
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label>Stream URL (HLS/RTSP)</label>
          <input
            type="text"
            placeholder="e.g. /hls/C240-01/index.m3u8 or rtsp://..."
            value={form.streamUrl}
            onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
            disabled={isLoading}
          />
          <small style={{ color: 'var(--text-lo)' }}>
            Use HLS (.m3u8) for best browser compatibility
          </small>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={isLoading}
        >
          {isLoading ? 'Saving…' : isEdit ? 'Update Camera' : 'Add Camera'}
        </button>

        {isEdit && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={handleDelete}
            disabled={isLoading}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        )}

        <button
          type="button"
          className={`${styles.btn} ${styles.btnSec}`}
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>

      {/* Note about dual-field workaround */}
      {!isEdit && (
        <p className={styles.note}>
          💡 Backend sends both field sets for compatibility. No need to worry about it.
        </p>
      )}
    </form>
  );
}
