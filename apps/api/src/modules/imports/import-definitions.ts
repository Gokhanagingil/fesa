import { AthleteStatus } from '../../database/enums';

export type ImportEntityKey = 'athletes' | 'guardians' | 'athlete_guardians' | 'groups';

export type ImportFieldType = 'string' | 'enum' | 'date' | 'email' | 'phone' | 'boolean';

export interface ImportFieldDefinition {
  /** Stable target key used by the API. */
  key: string;
  /** i18n key under `pages.imports.fields.<entity>.<key>`; UI resolves. */
  labelKey: string;
  /** Whether this column must be mapped before commit is allowed. */
  required: boolean;
  /** Aliases the auto-mapper recognises (case-insensitive). Includes EN + TR labels. */
  aliases: string[];
  type: ImportFieldType;
  /** Soft length cap, mirrors the underlying database column where useful. */
  maxLength?: number;
  /** Allowed enum values (lowercase). */
  enumValues?: string[];
  /** Short hint key for the UI. */
  hintKey?: string;
}

export interface ImportEntityDefinition {
  entity: ImportEntityKey;
  /** i18n key under `pages.imports.entities.<entity>`. */
  labelKey: string;
  /** Short description i18n key. */
  descriptionKey: string;
  /** Sample row used for the downloadable CSV template. */
  sample: Array<Record<string, string>>;
  fields: ImportFieldDefinition[];
}

/**
 * Each entity has a small, explicit column contract on purpose. New columns
 * are a one-place change here plus the corresponding handler in
 * `ImportsService`. We do not introduce a generic schema-mapping engine.
 */
export const IMPORT_DEFINITIONS: ImportEntityDefinition[] = [
  {
    entity: 'athletes',
    labelKey: 'pages.imports.entities.athletes.title',
    descriptionKey: 'pages.imports.entities.athletes.description',
    sample: [
      {
        firstName: 'Defne',
        lastName: 'Yıldız',
        preferredName: '',
        birthDate: '2014-05-12',
        gender: 'female',
        sportBranch: 'Basketball',
        primaryGroup: 'U12 Basketball',
        status: 'active',
        jerseyNumber: '7',
        notes: '',
      },
      {
        firstName: 'Kerem',
        lastName: 'Aksoy',
        preferredName: '',
        birthDate: '2013-09-30',
        gender: 'male',
        sportBranch: 'Basketball',
        primaryGroup: 'U13 Basketball',
        status: 'trial',
        jerseyNumber: '',
        notes: 'Trial – first month',
      },
    ],
    fields: [
      {
        key: 'firstName',
        labelKey: 'pages.imports.fields.athletes.firstName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['firstname', 'first name', 'ad', 'isim', 'name'],
      },
      {
        key: 'lastName',
        labelKey: 'pages.imports.fields.athletes.lastName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['lastname', 'last name', 'soyad', 'surname'],
      },
      {
        key: 'preferredName',
        labelKey: 'pages.imports.fields.athletes.preferredName',
        required: false,
        type: 'string',
        maxLength: 160,
        aliases: ['preferred name', 'preferredname', 'çağrılan ad', 'lakap'],
      },
      {
        key: 'birthDate',
        labelKey: 'pages.imports.fields.athletes.birthDate',
        required: false,
        type: 'date',
        aliases: ['birthdate', 'birth date', 'dob', 'date of birth', 'doğum tarihi', 'dogum tarihi'],
        hintKey: 'pages.imports.hints.dateFormat',
      },
      {
        key: 'gender',
        labelKey: 'pages.imports.fields.athletes.gender',
        required: false,
        type: 'string',
        maxLength: 32,
        aliases: ['gender', 'cinsiyet', 'sex'],
      },
      {
        key: 'sportBranch',
        labelKey: 'pages.imports.fields.athletes.sportBranch',
        required: true,
        type: 'string',
        maxLength: 160,
        aliases: ['sport branch', 'sportbranch', 'branch', 'spor branşı', 'spor brans', 'discipline'],
        hintKey: 'pages.imports.hints.sportBranch',
      },
      {
        key: 'primaryGroup',
        labelKey: 'pages.imports.fields.athletes.primaryGroup',
        required: false,
        type: 'string',
        maxLength: 200,
        aliases: ['group', 'primary group', 'cohort', 'grup', 'birincil grup', 'takım grubu'],
        hintKey: 'pages.imports.hints.primaryGroup',
      },
      {
        key: 'status',
        labelKey: 'pages.imports.fields.athletes.status',
        required: false,
        type: 'enum',
        enumValues: Object.values(AthleteStatus),
        aliases: ['status', 'durum', 'state'],
        hintKey: 'pages.imports.hints.athleteStatus',
      },
      {
        key: 'jerseyNumber',
        labelKey: 'pages.imports.fields.athletes.jerseyNumber',
        required: false,
        type: 'string',
        maxLength: 8,
        aliases: ['jersey', 'jerseynumber', 'jersey number', 'forma no', 'forma'],
      },
      {
        key: 'notes',
        labelKey: 'pages.imports.fields.athletes.notes',
        required: false,
        type: 'string',
        maxLength: 500,
        aliases: ['notes', 'not', 'açıklama', 'aciklama'],
      },
    ],
  },
  {
    entity: 'guardians',
    labelKey: 'pages.imports.entities.guardians.title',
    descriptionKey: 'pages.imports.entities.guardians.description',
    sample: [
      {
        firstName: 'Ayşe',
        lastName: 'Yıldız',
        phone: '+905551234567',
        email: 'ayse.yildiz@example.com',
        notes: 'Mother of Defne',
      },
      {
        firstName: 'Murat',
        lastName: 'Aksoy',
        phone: '05550001122',
        email: '',
        notes: '',
      },
    ],
    fields: [
      {
        key: 'firstName',
        labelKey: 'pages.imports.fields.guardians.firstName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['firstname', 'first name', 'ad', 'isim'],
      },
      {
        key: 'lastName',
        labelKey: 'pages.imports.fields.guardians.lastName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['lastname', 'last name', 'soyad'],
      },
      {
        key: 'phone',
        labelKey: 'pages.imports.fields.guardians.phone',
        required: false,
        type: 'phone',
        maxLength: 32,
        aliases: ['phone', 'telefon', 'mobile', 'cep', 'gsm'],
      },
      {
        key: 'email',
        labelKey: 'pages.imports.fields.guardians.email',
        required: false,
        type: 'email',
        maxLength: 320,
        aliases: ['email', 'e-mail', 'mail', 'eposta', 'e-posta'],
      },
      {
        key: 'notes',
        labelKey: 'pages.imports.fields.guardians.notes',
        required: false,
        type: 'string',
        maxLength: 500,
        aliases: ['notes', 'not', 'açıklama', 'aciklama'],
      },
    ],
  },
  {
    entity: 'athlete_guardians',
    labelKey: 'pages.imports.entities.athleteGuardians.title',
    descriptionKey: 'pages.imports.entities.athleteGuardians.description',
    sample: [
      {
        athleteFirstName: 'Defne',
        athleteLastName: 'Yıldız',
        guardianFirstName: 'Ayşe',
        guardianLastName: 'Yıldız',
        relationshipType: 'mother',
        isPrimaryContact: 'true',
        notes: '',
      },
      {
        athleteFirstName: 'Kerem',
        athleteLastName: 'Aksoy',
        guardianFirstName: 'Murat',
        guardianLastName: 'Aksoy',
        relationshipType: 'father',
        isPrimaryContact: 'true',
        notes: '',
      },
    ],
    fields: [
      {
        key: 'athleteFirstName',
        labelKey: 'pages.imports.fields.athleteGuardians.athleteFirstName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['athletefirstname', 'athlete first name', 'sporcu adı', 'sporcu adi'],
      },
      {
        key: 'athleteLastName',
        labelKey: 'pages.imports.fields.athleteGuardians.athleteLastName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['athletelastname', 'athlete last name', 'sporcu soyadı', 'sporcu soyadi'],
      },
      {
        key: 'guardianFirstName',
        labelKey: 'pages.imports.fields.athleteGuardians.guardianFirstName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['guardianfirstname', 'guardian first name', 'veli adı', 'veli adi'],
      },
      {
        key: 'guardianLastName',
        labelKey: 'pages.imports.fields.athleteGuardians.guardianLastName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['guardianlastname', 'guardian last name', 'veli soyadı', 'veli soyadi'],
      },
      {
        key: 'relationshipType',
        labelKey: 'pages.imports.fields.athleteGuardians.relationshipType',
        required: true,
        type: 'enum',
        enumValues: ['mother', 'father', 'guardian', 'other'],
        aliases: ['relationshiptype', 'relationship', 'relation', 'yakınlık', 'yakinlik'],
        hintKey: 'pages.imports.hints.relationshipType',
      },
      {
        key: 'isPrimaryContact',
        labelKey: 'pages.imports.fields.athleteGuardians.isPrimaryContact',
        required: false,
        type: 'boolean',
        aliases: [
          'isprimarycontact',
          'primary',
          'primary contact',
          'birincil iletişim',
          'birincil iletisim',
        ],
      },
      {
        key: 'notes',
        labelKey: 'pages.imports.fields.athleteGuardians.notes',
        required: false,
        type: 'string',
        maxLength: 500,
        aliases: ['notes', 'not', 'açıklama', 'aciklama'],
      },
    ],
  },
  {
    entity: 'groups',
    labelKey: 'pages.imports.entities.groups.title',
    descriptionKey: 'pages.imports.entities.groups.description',
    sample: [
      {
        name: 'U10 Basketball',
        sportBranch: 'Basketball',
        headCoachName: 'Selin Demir',
      },
      {
        name: 'U12 Basketball',
        sportBranch: 'Basketball',
        headCoachName: '',
      },
    ],
    fields: [
      {
        key: 'name',
        labelKey: 'pages.imports.fields.groups.name',
        required: true,
        type: 'string',
        maxLength: 200,
        aliases: ['name', 'group', 'group name', 'grup', 'grup adı', 'grup adi'],
      },
      {
        key: 'sportBranch',
        labelKey: 'pages.imports.fields.groups.sportBranch',
        required: true,
        type: 'string',
        maxLength: 160,
        aliases: ['sport branch', 'sportbranch', 'branch', 'spor branşı', 'spor brans', 'discipline'],
        hintKey: 'pages.imports.hints.sportBranch',
      },
      {
        key: 'headCoachName',
        labelKey: 'pages.imports.fields.groups.headCoachName',
        required: false,
        type: 'string',
        maxLength: 200,
        aliases: [
          'headcoach',
          'head coach',
          'coach',
          'baş antrenör',
          'bas antrenor',
          'antrenör',
          'antrenor',
        ],
        hintKey: 'pages.imports.hints.headCoach',
      },
    ],
  },
];

export function getImportDefinition(entity: string): ImportEntityDefinition | undefined {
  return IMPORT_DEFINITIONS.find((definition) => definition.entity === entity);
}
