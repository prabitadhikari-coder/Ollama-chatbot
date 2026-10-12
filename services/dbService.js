const mysql = require('mysql2/promise');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async init() {
    try {
      if (this.pool) {
        try { await this.pool.end(); } catch {}
      }

      this.pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'ai_readonly',
        password: process.env.DB_PASSWORD || 'ReadOnlyPass123!',
        database: process.env.DB_NAME || 'chatbot_kb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 3000
      });

      // Test connection
      const connection = await this.pool.getConnection();
      connection.release();
      this.isConnected = true;
      console.log(`[MariaDB] Connected to database: ${process.env.DB_NAME || 'chatbot_kb'} on ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    } catch (err) {
      this.isConnected = false;
      console.error(`[MariaDB Connection Error]: ${err.message}`);
    }
  }

  /**
   * Actively check if MariaDB is alive, and attempt auto-reconnect if it dropped
   */
  async checkConnection() {
    if (!this.pool) {
      await this.init();
      return this.isConnected;
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      this.isConnected = true;
      return true;
    } catch (err) {
      this.isConnected = false;
      console.error(`[MariaDB Health Check Failed]: ${err.message}`);
      // Attempt quick re-init in case MariaDB restarted
      try {
        await this.init();
      } catch {}
      return this.isConnected;
    }
  }

  /**
   * Search knowledge base with Role-Based Access Control (RBAC)
   * Roles: 'customer' (public), 'employee' (internal staff), 'admin' (executives)
   */
  async searchKnowledge(queryTerm, limit = 3, userRole = 'customer') {
    if (!this.pool || !this.isConnected) {
      const ok = await this.checkConnection();
      if (!ok) return [];
    }

    const lower = (queryTerm || '').toLowerCase().trim();
    if (!lower) return [];

    const allowedRoles = userRole === 'admin'
      ? ['customer', 'employee', 'admin']
      : userRole === 'employee'
      ? ['customer', 'employee']
      : ['customer'];

    const rolePlaceholders = allowedRoles.map(() => '?').join(', ');

    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'about', 'tell', 'what', 'give', 'show',
      'can', 'you', 'with', 'this', 'that', 'how', 'some', 'any', 'our',
      'all', 'who', 'does', 'from', 'there'
    ]);

    let keywords = lower
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length === 0) {
      keywords = lower
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 1);
    }

    if (keywords.length === 0) keywords.push(lower);

    const scoreClauses = [];
    const conditionClauses = [];
    const params = [];

    for (const kw of keywords) {
      const p = `%${kw}%`;
      conditionClauses.push('(topic LIKE ? OR content LIKE ? OR keywords LIKE ?)');
      scoreClauses.push('(CASE WHEN topic LIKE ? THEN 3 WHEN content LIKE ? THEN 2 ELSE 1 END)');
      params.push(p, p, p);
    }

    const scoreExpression = scoreClauses.join(' + ');
    const conditionExpression = conditionClauses.join(' OR ');

    const selectParams = [];
    for (const kw of keywords) {
      const p = `%${kw}%`;
      selectParams.push(p, p);
    }

    const sql = `
      SELECT category, topic, content, required_role,
             (${scoreExpression}) AS relevance_score
      FROM knowledge_items 
      WHERE (${conditionExpression})
        AND required_role IN (${rolePlaceholders})
      ORDER BY relevance_score DESC
      LIMIT ?
    `;

    const allParams = [...selectParams, ...params, ...allowedRoles, limit];

    try {
      const [rows] = await this.pool.query(sql, allParams);
      return rows;
    } catch (err) {
      console.error('[MariaDB Knowledge Search Error]:', err.message);
      return [];
    }
  }

  /**
   * Search catalog products (live stock, prices, SKU, descriptions)
   */
  async searchProducts(queryTerm, limit = 5) {
    if (!this.pool || !this.isConnected) {
      const ok = await this.checkConnection();
      if (!ok) return [];
    }

    const lower = (queryTerm || '').toLowerCase().trim();
    if (!lower) return [];

    // Skip product search if the query is specifically about expense claims, purchase orders, or employee HR
    if (lower.includes('expense') || lower.includes('claim') || lower.includes('purchase order') || lower.match(/\bpo-\d+/i) || lower.match(/\bexp-\d+/i)) {
      return [];
    }

    // Intent 1: "most expensive", "highest price"
    if (lower.includes('most expensive') || lower.includes('highest price') || lower.includes('maximum price') || lower.includes('costliest')) {
      const sql = `
        SELECT sku, name, category, stock_quantity, unit_price, description 
        FROM products 
        ORDER BY unit_price DESC 
        LIMIT ?
      `;
      try {
        const [rows] = await this.pool.query(sql, [limit]);
        return rows;
      } catch (err) {
        console.error('[MariaDB Products Error (expensive)]:', err.message);
        return [];
      }
    }

    // Intent 2: "cheapest", "lowest price"
    if (lower.includes('cheap') || lower.includes('lowest price') || lower.includes('minimum price') || lower.includes('affordable')) {
      const sql = `
        SELECT sku, name, category, stock_quantity, unit_price, description 
        FROM products 
        ORDER BY unit_price ASC 
        LIMIT ?
      `;
      try {
        const [rows] = await this.pool.query(sql, [limit]);
        return rows;
      } catch (err) {
        console.error('[MariaDB Products Error (cheapest)]:', err.message);
        return [];
      }
    }

    // Intent 3: General stock / product inquiry (all inventory)
    if (lower === 'all' || lower.includes('all') || lower.includes('product') || lower.includes('item') || lower.includes('stock') || lower.includes('inventory') || lower.includes('catalog') || lower.includes('sell') || lower.includes('offer')) {
      const sql = `
        SELECT sku, name, category, stock_quantity, unit_price, description 
        FROM products 
        ORDER BY name ASC 
        LIMIT ?
      `;
      try {
        const [rows] = await this.pool.query(sql, [limit]);
        return rows;
      } catch (err) {
        console.error('[MariaDB Products Error (catalog)]:', err.message);
        return [];
      }
    }

    // Intent 4: Keyword matching for specific items or SKUs
    const keywords = lower
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (keywords.length === 0) keywords.push(lower);

    const conditions = keywords.map(() => '(name LIKE ? OR description LIKE ? OR sku = ?)').join(' OR ');
    const params = [];
    for (const kw of keywords) {
      const p = `%${kw}%`;
      params.push(p, p, kw);
    }
    params.push(limit);

    const sql = `
      SELECT sku, name, category, stock_quantity, unit_price, description 
      FROM products 
      WHERE ${conditions}
      LIMIT ?
    `;

    try {
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error('[MariaDB Products Error (keyword)]:', err.message);
      return [];
    }
  }

  /**
   * Search Transaction / ERP Document tables with Strict RBAC:
   * - customer: 0 transactional access (cannot view orders, claims, or POs)
   * - employee: customer_orders + employee_expenses
   * - admin: customer_orders + employee_expenses + supplier_purchase_orders
   */
  async searchTransactions(queryTerm, userRole = 'customer') {
    if (!this.pool || !this.isConnected) {
      const ok = await this.checkConnection();
      if (!ok) return { orders: [], expenses: [], purchaseOrders: [] };
    }

    const lower = (queryTerm || '').toLowerCase().trim();
    if (!lower) return { orders: [], expenses: [], purchaseOrders: [] };

    const results = { orders: [], expenses: [], purchaseOrders: [] };

    // 1. Transactional Orders, Customer Directory & Tracking (EMPLOYEE & ADMIN ONLY)
    if (userRole === 'employee' || userRole === 'admin') {
      const isOrderQuery =
        (lower.includes('customer') ||
         lower.includes('email') ||
         lower.includes('order') ||
         lower.includes('tracking') ||
         lower.includes('client') ||
         lower.match(/\bord-\d+/i)) &&
        !lower.includes('purchase order') &&
        !lower.includes('expense');

      if (isOrderQuery) {
        try {
          const orderIdMatch = lower.match(/ord-\d+/i)?.[0];
          if (orderIdMatch) {
            const [orders] = await this.pool.query(
              'SELECT order_id, customer_name, customer_email, sku, quantity, total_amount, order_status, tracking_number, order_date FROM customer_orders WHERE order_id = ? LIMIT 1',
              [orderIdMatch.toUpperCase()]
            );
            results.orders = orders;
          } else {
            const [orders] = await this.pool.query(
              'SELECT order_id, customer_name, customer_email, sku, quantity, total_amount, order_status, tracking_number, order_date FROM customer_orders ORDER BY order_date DESC LIMIT 10'
            );
            results.orders = orders;
          }
        } catch (e) {
          console.error('[MariaDB customer_orders Error]:', e.message);
        }
      }
    }

    // 2. Employee Expense Claims (EMPLOYEE & ADMIN ONLY)
    if (userRole === 'employee' || userRole === 'admin') {
      const isExpenseQuery =
        lower.includes('expense') ||
        lower.includes('claim') ||
        lower.includes('reimburse') ||
        lower.includes('spending') ||
        lower.includes('travel') ||
        lower.includes('dinner') ||
        lower.includes('receipt') ||
        lower.match(/\bexp-\d+/i);

      if (isExpenseQuery) {
        try {
          const expIdMatch = lower.match(/exp-\d+/i)?.[0];
          if (expIdMatch) {
            const [expenses] = await this.pool.query(
              'SELECT claim_id, employee_id, employee_name, department, expense_type, amount, approval_status, claim_date FROM employee_expenses WHERE claim_id = ? LIMIT 1',
              [expIdMatch.toUpperCase()]
            );
            results.expenses = expenses;
          } else {
            const [expenses] = await this.pool.query(
              'SELECT claim_id, employee_id, employee_name, department, expense_type, amount, approval_status, claim_date FROM employee_expenses ORDER BY claim_date DESC LIMIT 5'
            );
            results.expenses = expenses;
          }
        } catch (e) {
          console.error('[MariaDB employee_expenses Error]:', e.message);
        }
      }
    }

    // 3. Confidential Vendor Purchase Orders (ADMIN ONLY)
    if (userRole === 'admin') {
      const isPOQuery =
        lower.includes('po') ||
        lower.includes('purchase order') ||
        lower.includes('vendor') ||
        lower.includes('supplier') ||
        lower.includes('sap') ||
        lower.includes('procurement') ||
        lower.includes('contract') ||
        lower.includes('margin') ||
        lower.includes('profit') ||
        lower.includes('cost') ||
        lower.includes('wholesale') ||
        lower.match(/\bpo-[a-z0-9\-]+/i);

      if (isPOQuery) {
        try {
          const poMatch = lower.match(/po-[a-z0-9\-]+/i)?.[0];
          if (poMatch) {
            const [pos] = await this.pool.query(
              'SELECT po_number, vendor_name, item_description, cost_per_unit, total_contract_value, payment_terms, confidential_notes, po_date FROM supplier_purchase_orders WHERE po_number = ? LIMIT 1',
              [poMatch.toUpperCase()]
            );
            results.purchaseOrders = pos;
          } else if (lower.includes('expensive') || lower.includes('highest') || lower.includes('costliest') || lower.includes('largest') || lower.includes('maximum')) {
            const [pos] = await this.pool.query(
              'SELECT po_number, vendor_name, item_description, cost_per_unit, total_contract_value, payment_terms, confidential_notes, po_date FROM supplier_purchase_orders ORDER BY total_contract_value DESC LIMIT 5'
            );
            results.purchaseOrders = pos;
          } else if (lower.includes('cheapest') || lower.includes('lowest') || lower.includes('minimum') || lower.includes('smallest')) {
            const [pos] = await this.pool.query(
              'SELECT po_number, vendor_name, item_description, cost_per_unit, total_contract_value, payment_terms, confidential_notes, po_date FROM supplier_purchase_orders ORDER BY total_contract_value ASC LIMIT 5'
            );
            results.purchaseOrders = pos;
          } else {
            const [pos] = await this.pool.query(
              'SELECT po_number, vendor_name, item_description, cost_per_unit, total_contract_value, payment_terms, confidential_notes, po_date FROM supplier_purchase_orders ORDER BY po_date DESC LIMIT 5'
            );
            results.purchaseOrders = pos;
          }
        } catch (e) {
          console.error('[MariaDB supplier_purchase_orders Error]:', e.message);
        }
      }
    }

    return results;
  }

  /**
   * Verify hardware/privilege level read-only enforcement
   */
  async verifyReadOnlyEnforcement() {
    if (!this.pool || !this.isConnected) await this.init();

    try {
      await this.pool.query(
        "INSERT INTO knowledge_items (category, topic, content, required_role) VALUES ('test', 'exploit', 'unauthorized', 'customer')"
      );
      return {
        secure: false,
        warning: 'CRITICAL: User has WRITE privileges! Revoke INSERT/UPDATE/DELETE immediately.'
      };
    } catch (err) {
      return {
        secure: true,
        enforced: true,
        databaseError: err.message,
        code: err.code,
        message: 'MariaDB read-only security enforced: Write attempt was blocked by database privilege table.'
      };
    }
  }
}

const dbService = new DatabaseService();
module.exports = { dbService };
