-- VercelDb.sql: PostgreSQL schema for MonthlyExpenseUdDB

-- 1. REfFieldType table
CREATE TABLE IF NOT EXISTS REfFieldType (
    FieldTypeId SERIAL PRIMARY KEY,
    Description VARCHAR(100) NOT NULL
);

-- Seed REfFieldType
INSERT INTO REfFieldType (FieldTypeId, Description) VALUES
(1, 'Int'),
(2, 'DateTime'),
(3, 'Varchar'),
(4, 'Decimal'),
(5, 'Bit')
ON CONFLICT (FieldTypeId) DO NOTHING;

-- 2. RefHome table
CREATE TABLE IF NOT EXISTS RefHome (
    RefHomeId SERIAL PRIMARY KEY,
    HomeMenuName VARCHAR(255) NOT NULL,
    UiPagename VARCHAR(255),
    editaccess BIT(1) DEFAULT B'1',
    viewaccess BIT(1) DEFAULT B'1',
    deleteacess BIT(1) DEFAULT B'1',
    updateaccess BIT(1) DEFAULT B'1',
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ParentmenuId INTEGER,
    displayOrder INTEGER DEFAULT 0
);

-- 3. RefAddExpenseMenu table
CREATE TABLE IF NOT EXISTS RefAddExpenseMenu (
    AddExpenseMenuId SERIAL PRIMARY KEY,
    AddExpenseMenuName VARCHAR(255) NOT NULL,
    editaccess BIT(1) DEFAULT B'1',
    viewaccess BIT(1) DEFAULT B'1',
    deleteacess BIT(1) DEFAULT B'1',
    updateaccess BIT(1) DEFAULT B'1',
    FieldTypeId INTEGER REFERENCES REfFieldType(FieldTypeId),
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ParentmenuId INTEGER,
    FieldType VARCHAR(50),
    displayOrder INTEGER DEFAULT 0
);

-- 4. RefEmiMenu table
CREATE TABLE IF NOT EXISTS RefEmiMenu (
    EmiMenuId SERIAL PRIMARY KEY,
    AddExpenseMenuName VARCHAR(255) NOT NULL, -- Keep exact name from prompt
    editaccess BIT(1) DEFAULT B'1',
    viewaccess BIT(1) DEFAULT B'1',
    deleteacess BIT(1) DEFAULT B'1',
    updateaccess BIT(1) DEFAULT B'1',
    IsActive BOOLEAN DEFAULT TRUE,
    FieldTypeId INTEGER REFERENCES REfFieldType(FieldTypeId),
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ParentmenuId INTEGER,
    FieldType VARCHAR(50),
    displayOrder INTEGER DEFAULT 0
);

-- 5. RefRole table
CREATE TABLE IF NOT EXISTS RefRole (
    RoleId SERIAL PRIMARY KEY,
    RoleName VARCHAR(100) UNIQUE NOT NULL,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    displayOrder INTEGER DEFAULT 0
);

-- Seed RefRole
INSERT INTO RefRole (RoleId, RoleName, IsActive, displayOrder) VALUES
(1, 'Admin', TRUE, 1),
(2, 'User', TRUE, 2),
(3, 'Viewer', TRUE, 3)
ON CONFLICT (RoleId) DO NOTHING;

-- 6. RefRoleAccess table
CREATE TABLE IF NOT EXISTS RefRoleAccess (
    RoleAccessId SERIAL PRIMARY KEY,
    RoleId INTEGER REFERENCES RefRole(RoleId) ON DELETE CASCADE,
    MenuId INTEGER, -- maps to RefHomeId, AddExpenseMenuId, or EmiMenuId depending on type
    Editaccess BIT(1) DEFAULT B'1',
    DeleteAccess BIT(1) DEFAULT B'1',
    Addaccess BIT(1) DEFAULT B'1',
    updateaccess BIT(1) DEFAULT B'1',
    isactive BOOLEAN DEFAULT TRUE,
    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. RefImportExport table
CREATE TABLE IF NOT EXISTS RefImportExport (
    ImportExportId SERIAL PRIMARY KEY, -- 1 is import, 2 is export
    Description VARCHAR(255) NOT NULL,
    displayOrder INTEGER DEFAULT 0,
    FieldTypeId INTEGER REFERENCES REfFieldType(FieldTypeId),
    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed RefImportExport
INSERT INTO RefImportExport (ImportExportId, Description, displayOrder, FieldTypeId) VALUES
(1, 'Import', 1, 3),
(2, 'Export', 2, 3)
ON CONFLICT (ImportExportId) DO NOTHING;

-- 8. RefImportExportDetails table
CREATE TABLE IF NOT EXISTS RefImportExportDetails (
    ImportExportDtlId SERIAL PRIMARY KEY,
    ImportExportId INTEGER REFERENCES RefImportExport(ImportExportId) ON DELETE CASCADE,
    columnDescription VARCHAR(255) NOT NULL,
    FieldTypeId INTEGER REFERENCES REfFieldType(FieldTypeId),
    isactive BOOLEAN DEFAULT TRUE,
    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    displayOrder INTEGER DEFAULT 0
);

-- 9. Refusers table
CREATE TABLE IF NOT EXISTS Refusers (
    LoginId SERIAL PRIMARY KEY,
    Username VARCHAR(100) UNIQUE NOT NULL,
    Firstname VARCHAR(100),
    Lastname VARCHAR(100),
    Email VARCHAR(150) UNIQUE,
    Phone VARCHAR(50) UNIQUE,
    saltkey VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    isactive BOOLEAN DEFAULT TRUE,
    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. UserRole table
CREATE TABLE IF NOT EXISTS UserRole (
    UserRoleId SERIAL PRIMARY KEY,
    LoginId INTEGER REFERENCES Refusers(LoginId) ON DELETE CASCADE,
    RoleId INTEGER REFERENCES RefRole(RoleId) ON DELETE CASCADE,
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastchangePassword TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PasswordExpiry TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    isactive BOOLEAN DEFAULT TRUE
);

-- 11. UserLoginDetails table
CREATE TABLE IF NOT EXISTS UserLoginDetails (
    UserLoginDtlId SERIAL PRIMARY KEY,
    Loginid INTEGER REFERENCES Refusers(LoginId) ON DELETE CASCADE,
    LoginDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    LogOutDate TIMESTAMP,
    Browser VARCHAR(255),
    Otp VARCHAR(10)
);

-- 12. Refcurreny table
CREATE TABLE IF NOT EXISTS Refcurreny (
    CurrencyId SERIAL PRIMARY KEY,
    Country VARCHAR(100) UNIQUE NOT NULL,
    Description VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Refcurreny
INSERT INTO Refcurreny (CurrencyId, Country, Description, symbol, active) VALUES
(1, 'India', 'Indian Rupee', '₹', TRUE),
(2, 'USA', 'US Dollar', '$', FALSE),
(3, 'Europe', 'Euro', '€', FALSE),
(4, 'UK', 'British Pound', '£', FALSE)
ON CONFLICT (CurrencyId) DO NOTHING;

-- Additional operational tables required by application
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES Refusers(LoginId) ON DELETE CASCADE,
    amount REAL NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    date VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bank_mode VARCHAR(100),
    payment_type VARCHAR(100),
    payment_category VARCHAR(100),
    interest REAL DEFAULT 0.0,
    payment_method VARCHAR(50) DEFAULT 'Debit',
    status VARCHAR(50) DEFAULT 'Paid',
    createddate VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS emis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES Refusers(LoginId) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    principal_amount REAL DEFAULT 0.0,
    emi_amount REAL NOT NULL,
    start_date VARCHAR(20) NOT NULL,
    end_date VARCHAR(20) NOT NULL,
    tenure_months INTEGER NOT NULL,
    interest_rate REAL NOT NULL,
    due_date VARCHAR(20) NOT NULL,
    payment_type VARCHAR(100) NOT NULL,
    payment_gateway VARCHAR(100),
    payment_bank VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createddate VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    target VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
('registration_otp_enabled', '0'),
('login_otp_enabled', '0')
ON CONFLICT (key) DO NOTHING;
