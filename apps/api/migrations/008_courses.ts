import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      required_tier VARCHAR(20) DEFAULT 'SOA_CORE',
      position INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE course_modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      video_url TEXT,
      duration_seconds INTEGER,
      position INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE course_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      module_id UUID REFERENCES course_modules(id),
      completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP,
      watch_time_seconds INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, module_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS course_progress;');
  await knex.raw('DROP TABLE IF EXISTS course_modules;');
  await knex.raw('DROP TABLE IF EXISTS courses;');
}
