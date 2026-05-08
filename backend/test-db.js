const { Incident, TeamMember } = require('./models');

async function testDatabase() {
    try {
        console.log('Testing database connection...');
        
        // Test if we can query team members
        const teamMembers = await TeamMember.getAll();
        console.log('Team members found:', teamMembers.length);
        
        // Test if we can query incidents table
        const incidents = await Incident.findAll({ limit: 3 });
        console.log('Incidents found:', incidents.length);
        
        // Test if guard_001 exists
        const guard = await TeamMember.getById('guard_001');
        console.log('Guard 001 exists:', !!guard);
        if (guard) {
            console.log('Guard details:', guard);
        }
        
        console.log('Database test completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Database test failed:', error);
        process.exit(1);
    }
}

testDatabase();