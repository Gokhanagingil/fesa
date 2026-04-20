import { AthleteStatus, InventoryCategory } from '../../database/enums';

export type ImportEntityKey =
  | 'sport_branches'
  | 'coaches'
  | 'groups'
  | 'teams'
  | 'athletes'
  | 'guardians'
  | 'athlete_guardians'
  | 'charge_items'
  | 'inventory_items';

export type ImportFieldType =
  | 'string'
  | 'enum'
  | 'date'
  | 'email'
  | 'phone'
  | 'boolean'
  | 'integer'
  | 'decimal';

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
  /**
   * i18n key under `pages.imports.entities.<entity>.dependencies` describing
   * upstream entities this template assumes already exist (e.g. groups need
   * sport branches). Surfaced calmly in the wizard above the template button.
   */
  dependencyKey?: string;
}

/**
 * Each entity has a small, explicit column contract on purpose. New columns
 * are a one-place change here plus the corresponding handler in
 * `ImportsService`. We do not introduce a generic schema-mapping engine.
 */
export const IMPORT_DEFINITIONS: ImportEntityDefinition[] = [
  {
    entity: 'sport_branches',
    labelKey: 'pages.imports.entities.sportBranches.title',
    descriptionKey: 'pages.imports.entities.sportBranches.description',
    sample: [
      { name: 'Basketball', code: 'BASKETBALL' },
      { name: 'Volleyball', code: 'VOLLEYBALL' },
    ],
    fields: [
      {
        key: 'name',
        labelKey: 'pages.imports.fields.sportBranches.name',
        required: true,
        type: 'string',
        maxLength: 160,
        aliases: ['name', 'branch', 'spor branşı', 'spor brans', 'discipline', 'spor dalı', 'spor dali'],
      },
      {
        key: 'code',
        labelKey: 'pages.imports.fields.sportBranches.code',
        required: true,
        type: 'string',
        maxLength: 48,
        aliases: ['code', 'branch code', 'kod'],
        hintKey: 'pages.imports.hints.sportBranchCode',
      },
    ],
  },
  {
    entity: 'coaches',
    labelKey: 'pages.imports.entities.coaches.title',
    descriptionKey: 'pages.imports.entities.coaches.description',
    dependencyKey: 'pages.imports.entities.coaches.dependencies',
    sample: [
      {
        firstName: 'Selin',
        lastName: 'Demir',
        preferredName: '',
        sportBranch: 'Basketball',
        phone: '+905551112233',
        email: 'selin.demir@example.com',
        specialties: 'Skill development',
        notes: '',
      },
      {
        firstName: 'Mert',
        lastName: 'Kara',
        preferredName: '',
        sportBranch: 'Volleyball',
        phone: '',
        email: '',
        specialties: '',
        notes: '',
      },
    ],
    fields: [
      {
        key: 'firstName',
        labelKey: 'pages.imports.fields.coaches.firstName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['firstname', 'first name', 'ad', 'isim'],
      },
      {
        key: 'lastName',
        labelKey: 'pages.imports.fields.coaches.lastName',
        required: true,
        type: 'string',
        maxLength: 120,
        aliases: ['lastname', 'last name', 'soyad'],
      },
      {
        key: 'preferredName',
        labelKey: 'pages.imports.fields.coaches.preferredName',
        required: false,
        type: 'string',
        maxLength: 160,
        aliases: ['preferred name', 'preferredname', 'çağrılan ad', 'lakap'],
      },
      {
        key: 'sportBranch',
        labelKey: 'pages.imports.fields.coaches.sportBranch',
        required: true,
        type: 'string',
        maxLength: 160,
        aliases: ['sport branch', 'sportbranch', 'branch', 'spor branşı', 'spor brans', 'discipline'],
        hintKey: 'pages.imports.hints.sportBranch',
      },
      {
        key: 'phone',
        labelKey: 'pages.imports.fields.coaches.phone',
        required: false,
        type: 'phone',
        maxLength: 32,
        aliases: ['phone', 'telefon', 'mobile', 'cep', 'gsm'],
      },
      {
        key: 'email',
        labelKey: 'pages.imports.fields.coaches.email',
        required: false,
        type: 'email',
        maxLength: 320,
        aliases: ['email', 'e-mail', 'mail', 'eposta', 'e-posta'],
      },
      {
        key: 'specialties',
        labelKey: 'pages.imports.fields.coaches.specialties',
        required: false,
        type: 'string',
        maxLength: 200,
        aliases: ['specialties', 'specialty', 'uzmanlık', 'uzmanlik'],
      },
      {
        key: 'notes',
        labelKey: 'pages.imports.fields.coaches.notes',
        required: false,
        type: 'string',
        maxLength: 500,
        aliases: ['notes', 'not', 'açıklama', 'aciklama'],
      },
    ],
  },
  {
    entity: 'teams',
    labelKey: 'pages.imports.entities.teams.title',
    descriptionKey: 'pages.imports.entities.teams.description',
    dependencyKey: 'pages.imports.entities.teams.dependencies',
    sample: [
      {
        name: 'U10 Basketball A',
        sportBranch: 'Basketball',
        groupName: 'U10 Basketball',
        code: 'U10-A',
        headCoachName: 'Selin Demir',
      },
      {
        name: 'U12 Basketball B',
        sportBranch: 'Basketball',
        groupName: 'U12 Basketball',
        code: '',
        headCoachName: '',
      },
    ],
    fields: [
      {
        key: 'name',
        labelKey: 'pages.imports.fields.teams.name',
        required: true,
        type: 'string',
        maxLength: 200,
        aliases: ['name', 'team', 'team name', 'takım', 'takim', 'takım adı', 'takim adi'],
      },
      {
        key: 'sportBranch',
        labelKey: 'pages.imports.fields.teams.sportBranch',
        required: true,
        type: 'string',
        maxLength: 160,
        aliases: ['sport branch', 'sportbranch', 'branch', 'spor branşı', 'spor brans', 'discipline'],
        hintKey: 'pages.imports.hints.sportBranch',
      },
      {
        key: 'groupName',
        labelKey: 'pages.imports.fields.teams.groupName',
        required: false,
        type: 'string',
        maxLength: 200,
        aliases: ['group', 'group name', 'cohort', 'grup', 'grup adı', 'grup adi'],
        hintKey: 'pages.imports.hints.teamGroup',
      },
      {
        key: 'code',
        labelKey: 'pages.imports.fields.teams.code',
        required: false,
        type: 'string',
        maxLength: 32,
        aliases: ['code', 'kod', 'short code'],
      },
      {
        key: 'headCoachName',
        labelKey: 'pages.imports.fields.teams.headCoachName',
        required: false,
        type: 'string',
        maxLength: 200,
        aliases: ['headcoach', 'head coach', 'coach', 'baş antrenör', 'bas antrenor', 'antrenör', 'antrenor'],
        hintKey: 'pages.imports.hints.headCoach',
      },
    ],
  },
  {
    entity: 'athletes',
    labelKey: 'pages.imports.entities.athletes.title',
    descriptionKey: 'pages.imports.entities.athletes.description',
    dependencyKey: 'pages.imports.entities.athletes.dependencies',
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
    dependencyKey: 'pages.imports.entities.athleteGuardians.dependencies',
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
    dependencyKey: 'pages.imports.entities.groups.dependencies',
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

IMPORT_DEFINITIONS.push(
  {
    entity: 'charge_items',
    labelKey: 'pages.imports.entities.chargeItems.title',
    descriptionKey: 'pages.imports.entities.chargeItems.description',
    dependencyKey: 'pages.imports.entities.chargeItems.dependencies',
    sample: [
      {
        name: 'Monthly dues',
        category: 'dues',
        defaultAmount: '750.00',
        currency: 'TRY',
      },
      {
        name: 'Summer camp',
        category: 'camp',
        defaultAmount: '2500.00',
        currency: 'TRY',
      },
    ],
    fields: [
      {
        key: 'name',
        labelKey: 'pages.imports.fields.chargeItems.name',
        required: true,
        type: 'string',
        maxLength: 200,
        aliases: ['name', 'kalem', 'item', 'ad', 'isim'],
      },
      {
        key: 'category',
        labelKey: 'pages.imports.fields.chargeItems.category',
        required: true,
        type: 'string',
        maxLength: 64,
        aliases: ['category', 'kategori', 'tür', 'tur'],
        hintKey: 'pages.imports.hints.chargeCategory',
      },
      {
        key: 'defaultAmount',
        labelKey: 'pages.imports.fields.chargeItems.defaultAmount',
        required: true,
        type: 'decimal',
        aliases: ['defaultamount', 'default amount', 'amount', 'tutar', 'fiyat', 'price'],
        hintKey: 'pages.imports.hints.amount',
      },
      {
        key: 'currency',
        labelKey: 'pages.imports.fields.chargeItems.currency',
        required: true,
        type: 'enum',
        enumValues: ['try', 'eur', 'usd', 'gbp'],
        aliases: ['currency', 'para birimi', 'para', 'döviz', 'doviz'],
        hintKey: 'pages.imports.hints.currency',
      },
    ],
  },
  {
    entity: 'inventory_items',
    labelKey: 'pages.imports.entities.inventoryItems.title',
    descriptionKey: 'pages.imports.entities.inventoryItems.description',
    dependencyKey: 'pages.imports.entities.inventoryItems.dependencies',
    sample: [
      {
        name: 'Training jersey',
        category: 'apparel',
        sportBranch: 'Basketball',
        trackAssignment: 'true',
        initialStock: '20',
        lowStockThreshold: '4',
        description: 'Reversible practice jersey',
      },
      {
        name: 'Match ball',
        category: 'balls',
        sportBranch: 'Basketball',
        trackAssignment: 'false',
        initialStock: '12',
        lowStockThreshold: '2',
        description: '',
      },
    ],
    fields: [
      {
        key: 'name',
        labelKey: 'pages.imports.fields.inventoryItems.name',
        required: true,
        type: 'string',
        maxLength: 200,
        aliases: ['name', 'item', 'ürün', 'urun', 'malzeme', 'ad'],
      },
      {
        key: 'category',
        labelKey: 'pages.imports.fields.inventoryItems.category',
        required: true,
        type: 'enum',
        enumValues: Object.values(InventoryCategory),
        aliases: ['category', 'kategori', 'tür', 'tur'],
        hintKey: 'pages.imports.hints.inventoryCategory',
      },
      {
        key: 'sportBranch',
        labelKey: 'pages.imports.fields.inventoryItems.sportBranch',
        required: false,
        type: 'string',
        maxLength: 160,
        aliases: ['sport branch', 'sportbranch', 'branch', 'spor branşı', 'spor brans', 'discipline'],
        hintKey: 'pages.imports.hints.sportBranchOptional',
      },
      {
        key: 'trackAssignment',
        labelKey: 'pages.imports.fields.inventoryItems.trackAssignment',
        required: false,
        type: 'boolean',
        aliases: ['trackassignment', 'track assignment', 'assignable', 'kişisel', 'kisisel'],
        hintKey: 'pages.imports.hints.trackAssignment',
      },
      {
        key: 'initialStock',
        labelKey: 'pages.imports.fields.inventoryItems.initialStock',
        required: false,
        type: 'integer',
        aliases: ['initialstock', 'initial stock', 'stock', 'stok', 'başlangıç stoğu', 'baslangic stogu'],
        hintKey: 'pages.imports.hints.initialStock',
      },
      {
        key: 'lowStockThreshold',
        labelKey: 'pages.imports.fields.inventoryItems.lowStockThreshold',
        required: false,
        type: 'integer',
        aliases: [
          'lowstockthreshold',
          'low stock threshold',
          'low stock',
          'düşük stok',
          'dusuk stok',
        ],
        hintKey: 'pages.imports.hints.lowStockThreshold',
      },
      {
        key: 'description',
        labelKey: 'pages.imports.fields.inventoryItems.description',
        required: false,
        type: 'string',
        maxLength: 500,
        aliases: ['description', 'açıklama', 'aciklama', 'notes', 'not'],
      },
    ],
  },
);

export function getImportDefinition(entity: string): ImportEntityDefinition | undefined {
  return IMPORT_DEFINITIONS.find((definition) => definition.entity === entity);
}
