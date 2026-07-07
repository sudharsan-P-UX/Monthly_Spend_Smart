-- VercelDb.sql: SQL Server schema for MonthlyExpenseUdDB

-- 1. REfFieldType table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[REfFieldType]') AND type in (N'U'))
BEGIN
    CREATE TABLE REfFieldType (
        FieldTypeId INT IDENTITY(1,1) PRIMARY KEY,
        Description VARCHAR(100) NOT NULL
    );
END
GO

-- Seed REfFieldType
IF NOT EXISTS (SELECT * FROM REfFieldType WHERE FieldTypeId = 1)
BEGIN
    INSERT INTO REfFieldType (FieldTypeId, Description) VALUES
    (1, 'Int'),
    (2, 'DateTime'),
    (3, 'Varchar'),
    (4, 'Decimal'),
    (5, 'Bit');
END
GO

-- 2. RefHome table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefHome]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefHome (
        RefHomeId INT IDENTITY(1,1) PRIMARY KEY,
        HomeMenuName VARCHAR(255) NOT NULL,
        UiPagename VARCHAR(255),
        editaccess BIT DEFAULT 1,
        viewaccess BIT DEFAULT 1,
        deleteacess BIT DEFAULT 1,
        updateaccess BIT DEFAULT 1,
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETDATE(),
        ParentmenuId INT,
        displayOrder INT DEFAULT 0
    );
END
GO

-- 3. RefAddExpenseMenu table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefAddExpenseMenu]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefAddExpenseMenu (
        AddExpenseMenuId INT IDENTITY(1,1) PRIMARY KEY,
        AddExpenseMenuName VARCHAR(255) NOT NULL,
        editaccess BIT DEFAULT 1,
        viewaccess BIT DEFAULT 1,
        deleteacess BIT DEFAULT 1,
        updateaccess BIT DEFAULT 1,
        FieldTypeId INT REFERENCES REfFieldType(FieldTypeId),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETDATE(),
        ParentmenuId INT,
        FieldType VARCHAR(50),
        displayOrder INT DEFAULT 0
    );
END
GO

-- 4. RefEmiMenu table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefEmiMenu]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefEmiMenu (
        EmiMenuId INT IDENTITY(1,1) PRIMARY KEY,
        AddExpenseMenuName VARCHAR(255) NOT NULL,
        editaccess BIT DEFAULT 1,
        viewaccess BIT DEFAULT 1,
        deleteacess BIT DEFAULT 1,
        updateaccess BIT DEFAULT 1,
        IsActive BIT DEFAULT 1,
        FieldTypeId INT REFERENCES REfFieldType(FieldTypeId),
        CreatedDate DATETIME DEFAULT GETDATE(),
        ParentmenuId INT,
        FieldType VARCHAR(50),
        displayOrder INT DEFAULT 0
    );
END
GO

-- 5. RefRole table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefRole]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefRole (
        RoleId INT IDENTITY(1,1) PRIMARY KEY,
        RoleName VARCHAR(100) UNIQUE NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETDATE(),
        displayOrder INT DEFAULT 0
    );
END
GO

-- Seed RefRole
IF NOT EXISTS (SELECT * FROM RefRole WHERE RoleId = 1)
BEGIN
    INSERT INTO RefRole (RoleId, RoleName, IsActive, displayOrder) VALUES
    (1, 'Admin', 1, 1),
    (2, 'User', 1, 2),
    (3, 'Viewer', 1, 3);
END
GO

-- 6. RefRoleAccess table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefRoleAccess]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefRoleAccess (
        RoleAccessId INT IDENTITY(1,1) PRIMARY KEY,
        RoleId INT REFERENCES RefRole(RoleId) ON DELETE CASCADE,
        MenuId INT,
        Editaccess BIT DEFAULT 1,
        DeleteAccess BIT DEFAULT 1,
        Addaccess BIT DEFAULT 1,
        updateaccess BIT DEFAULT 1,
        isactive BIT DEFAULT 1,
        createddate DATETIME DEFAULT GETDATE()
    );
END
GO

-- 7. RefImportExport table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefImportExport]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefImportExport (
        ImportExportId INT IDENTITY(1,1) PRIMARY KEY,
        Description VARCHAR(255) NOT NULL,
        displayOrder INT DEFAULT 0,
        FieldTypeId INT REFERENCES REfFieldType(FieldTypeId),
        createddate DATETIME DEFAULT GETDATE()
    );
END
GO

-- Seed RefImportExport
IF NOT EXISTS (SELECT * FROM RefImportExport WHERE ImportExportId = 1)
BEGIN
    INSERT INTO RefImportExport (ImportExportId, Description, displayOrder, FieldTypeId) VALUES
    (1, 'Import', 1, 3),
    (2, 'Export', 2, 3);
END
GO

-- 8. RefImportExportDetails table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RefImportExportDetails]') AND type in (N'U'))
BEGIN
    CREATE TABLE RefImportExportDetails (
        ImportExportDtlId INT IDENTITY(1,1) PRIMARY KEY,
        ImportExportId INT REFERENCES RefImportExport(ImportExportId) ON DELETE CASCADE,
        columnDescription VARCHAR(255) NOT NULL,
        FieldTypeId INT REFERENCES REfFieldType(FieldTypeId),
        isactive BIT DEFAULT 1,
        createddate DATETIME DEFAULT GETDATE(),
        displayOrder INT DEFAULT 0
    );
END
GO

-- 9. Refusers table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Refusers]') AND type in (N'U'))
BEGIN
    CREATE TABLE Refusers (
        LoginId INT IDENTITY(1,1) PRIMARY KEY,
        Username VARCHAR(100) UNIQUE NOT NULL,
        Firstname VARCHAR(100),
        Lastname VARCHAR(100),
        Email VARCHAR(150) UNIQUE,
        Phone VARCHAR(50) UNIQUE,
        saltkey VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        isactive BIT DEFAULT 1,
        createddate DATETIME DEFAULT GETDATE()
    );
END
GO

-- 10. UserRole table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserRole]') AND type in (N'U'))
BEGIN
    CREATE TABLE UserRole (
        UserRoleId INT IDENTITY(1,1) PRIMARY KEY,
        LoginId INT REFERENCES Refusers(LoginId) ON DELETE CASCADE,
        RoleId INT REFERENCES RefRole(RoleId) ON DELETE CASCADE,
        CreatedDate DATETIME DEFAULT GETDATE(),
        lastchangePassword DATETIME DEFAULT GETDATE(),
        PasswordExpiry DATETIME DEFAULT DATEADD(day, 90, GETDATE()),
        isactive BIT DEFAULT 1
    );
END
GO

-- 11. UserLoginDetails table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserLoginDetails]') AND type in (N'U'))
BEGIN
    CREATE TABLE UserLoginDetails (
        UserLoginDtlId INT IDENTITY(1,1) PRIMARY KEY,
        Loginid INT REFERENCES Refusers(LoginId) ON DELETE CASCADE,
        LoginDate DATETIME DEFAULT GETDATE(),
        LogOutDate DATETIME,
        Browser VARCHAR(255),
        Otp VARCHAR(10)
    );
END
GO

-- 12. Refcurreny table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Refcurreny]') AND type in (N'U'))
BEGIN
    CREATE TABLE Refcurreny (
        CurrencyId INT IDENTITY(1,1) PRIMARY KEY,
        Country VARCHAR(100) UNIQUE NOT NULL,
        Description VARCHAR(100) NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        active BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETDATE()
    );
END
GO

-- Seed Refcurreny
IF NOT EXISTS (SELECT * FROM Refcurreny WHERE CurrencyId = 1)
BEGIN
    INSERT INTO Refcurreny (CurrencyId, Country, Description, symbol, active) VALUES
    (1, 'India', 'Indian Rupee', '₹', 1),
    (2, 'USA', 'US Dollar', '$', 0),
    (3, 'Europe', 'Euro', '€', 0),
    (4, 'UK', 'British Pound', '£', 0);
END
GO

-- Additional operational tables required by application
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[expenses]') AND type in (N'U'))
BEGIN
    CREATE TABLE expenses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL REFERENCES Refusers(LoginId) ON DELETE CASCADE,
        amount REAL NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        date VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        bank_mode VARCHAR(100),
        payment_type VARCHAR(100),
        payment_category VARCHAR(100),
        interest REAL DEFAULT 0.0,
        payment_method VARCHAR(50) DEFAULT 'Debit',
        status VARCHAR(50) DEFAULT 'Paid',
        createddate VARCHAR(20)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[emis]') AND type in (N'U'))
BEGIN
    CREATE TABLE emis (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL REFERENCES Refusers(LoginId) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        principal_amount REAL DEFAULT 0.0,
        emi_amount REAL NOT NULL,
        start_date VARCHAR(20) NOT NULL,
        end_date VARCHAR(20) NOT NULL,
        tenure_months INT NOT NULL,
        interest_rate REAL NOT NULL,
        due_date VARCHAR(20) NOT NULL,
        payment_type VARCHAR(100) NOT NULL,
        payment_gateway VARCHAR(100),
        payment_bank VARCHAR(100),
        created_at DATETIME DEFAULT GETDATE(),
        createddate VARCHAR(20)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[otps]') AND type in (N'U'))
BEGIN
    CREATE TABLE otps (
        id INT IDENTITY(1,1) PRIMARY KEY,
        target VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[settings]') AND type in (N'U'))
BEGIN
    CREATE TABLE settings (
        Setting VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255) NOT NULL
    );
END
GO

-- Seed default settings
IF NOT EXISTS (SELECT * FROM settings WHERE Setting = 'registration_otp_enabled')
BEGIN
    INSERT INTO settings (Setting, value) VALUES
    ('registration_otp_enabled', '0'),
    ('login_otp_enabled', '0');
END
GO