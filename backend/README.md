# CIFO Security System Backend

Backend API untuk sistem keamanan CIFO yang mengelola kamera CCTV, tim keamanan, aktivitas keamanan, dan data perumahan.

## Fitur Utama

- **Camera Management**: Monitoring dan kontrol kamera CCTV dengan heartbeat system
- **Team Management**: Manajemen tim keamanan dengan tracking lokasi real-time
- **Security Activity Logging**: Pencatatan dan analisis aktivitas keamanan
- **Perumahan Management**: Pengelolaan data perumahan dan fasilitas
- **Real-time Communication**: WebSocket untuk komunikasi real-time
- **Health Monitoring**: Monitoring kesehatan sistem secara otomatis

## Struktur Direktori

```
backend/
├── api/
│   ├── server.js          # Main server file
│   ├── router.js          # API routes
│   ├── store.js           # In-memory storage
│   └── queue.js           # Alert queue system
├── controllers/
│   ├── CameraController.js     # Camera CRUD & heartbeat
│   ├── TeamController.js       # Team management
│   ├── ActivityController.js   # Security activity logging
│   └── PerumahanController.js  # Housing complex management
├── models/
│   ├── Camera.js              # Camera data model
│   ├── CameraHealthLog.js     # Camera health logging
│   ├── TeamMember.js          # Team member model
│   ├── TeamLocationHistory.js # Location tracking
│   ├── SecurityActivity.js    # Activity logging model
│   └── Perumahan.js          # Housing complex model
├── services/
│   ├── WebSocketService.js    # Real-time communication
│   └── HealthMonitorService.js # System health monitoring
└── README.md
```

## API Endpoints

### Camera Management
- `GET /api/cameras` - Get all cameras with filters
- `GET /api/cameras/:id` - Get camera by ID
- `POST /api/cameras` - Create new camera
- `PUT /api/cameras/:id` - Update camera
- `DELETE /api/cameras/:id` - Delete camera
- `POST /api/cameras/:id/heartbeat` - Camera heartbeat
- `GET /api/cameras/stats` - Camera statistics
- `GET /api/cameras/health-logs` - Health logs

### Team Management
- `GET /api/team` - Get all team members
- `GET /api/team/:id` - Get team member by ID
- `POST /api/team` - Create new team member
- `PUT /api/team/:id` - Update team member
- `DELETE /api/team/:id` - Delete team member
- `POST /api/team/:id/location` - Update location
- `GET /api/team/stats` - Team statistics
- `GET /api/team/on-duty` - Get on-duty members

### Security Activities
- `GET /api/activities` - Get all activities with filters
- `GET /api/activities/:id` - Get activity by ID
- `POST /api/activities` - Create new activity
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity
- `GET /api/activities/stats` - Activity statistics
- `GET /api/activities/recent` - Recent activities

### Perumahan Management
- `GET /api/perumahan` - Get all perumahan
- `GET /api/perumahan/:id` - Get perumahan by ID
- `POST /api/perumahan` - Create new perumahan
- `PUT /api/perumahan/:id` - Update perumahan
- `DELETE /api/perumahan/:id` - Delete perumahan
- `GET /api/perumahan/:id/facilities` - Get facilities
- `POST /api/perumahan/:id/facilities` - Add facility

## Installation

1. Install dependencies:
```bash
npm install
```

2. Setup database:
   - Create MySQL database named `cifo_security`
   - Run migration files in order

3. Configure environment:
   - Copy `.env.example` to `.env`
   - Update database credentials

4. Start server:
```bash
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_NAME` | Database name | cifo_security |
| `DB_USER` | Database user | root |
| `DB_PASSWORD` | Database password | |
| `WS_PORT` | WebSocket port | 3002 |
| `FRONTEND_URL` | Frontend URL | http://localhost:3000 |

## WebSocket Events

### Client to Server
- `authenticate` - User authentication
- `join_room` - Join specific room
- `camera_status_update` - Update camera status
- `team_location_update` - Update team location
- `security_alert` - Send security alert

### Server to Client
- `authenticated` - Authentication success
- `camera_status_changed` - Camera status update
- `team_location_changed` - Team location update
- `security_alert` - Security alert broadcast
- `system_stats` - System statistics
- `health_alert` - System health alert

## Health Monitoring

Sistem monitoring otomatis yang berjalan setiap 2 menit:
- **Camera Health**: Monitoring status kamera dan koneksi
- **Team Status**: Monitoring aktivitas tim keamanan
- **System Performance**: Monitoring CPU, memory, dan disk usage
- **Data Cleanup**: Pembersihan data lama secara otomatis

## Database Schema

### cameras
- `id`, `name`, `location`, `ip_address`, `status`, `area_id`
- `last_heartbeat`, `created_at`, `updated_at`

### camera_health_logs
- `id`, `camera_id`, `status`, `response_time`, `error_message`
- `cpu_usage`, `memory_usage`, `disk_usage`, `timestamp`

### team_members
- `id`, `name`, `role`, `shift`, `phone`, `email`
- `duty_status`, `current_location`, `created_at`, `updated_at`

### team_location_history
- `id`, `member_id`, `latitude`, `longitude`, `area_id`
- `activity_type`, `timestamp`

### security_activities
- `id`, `type`, `severity`, `description`, `actor_id`
- `actor_type`, `reference_id`, `reference_type`, `timestamp`

### perumahan_info
- `id`, `name`, `address`, `total_units`, `occupied_units`
- `contact_person`, `phone`, `created_at`, `updated_at`

### perumahan_facilities
- `id`, `perumahan_id`, `name`, `type`, `status`
- `description`, `created_at`, `updated_at`

## Development

### Adding New Features
1. Create model in `models/`
2. Create controller in `controllers/`
3. Add routes in `api/router.js`
4. Update WebSocket events if needed
5. Add health monitoring if required

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Logging
Sistem menggunakan structured logging dengan level:
- `error`: Error yang memerlukan perhatian
- `warn`: Warning yang perlu dimonitor
- `info`: Informasi umum operasi
- `debug`: Detail untuk debugging

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure database with SSL
3. Set up reverse proxy (nginx)
4. Configure SSL certificates
5. Set up monitoring and alerting
6. Configure log rotation

## Security Considerations

- Semua endpoint memerlukan authentication
- Input validation pada semua endpoints
- Rate limiting untuk API calls
- SQL injection protection
- XSS protection
- CORS configuration

## Support

Untuk pertanyaan atau issue, silakan hubungi tim development atau buat issue di repository.