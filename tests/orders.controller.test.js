const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { OrdersController } = require('../dist/modules/orders/orders.controller');

function orderRepository() {
  const saved = [];
  const query = { clauses: [] };
  const queryBuilder = {
    leftJoinAndSelect() {
      return this;
    },
    where(clause) {
      query.clauses.push(clause);
      return this;
    },
    andWhere(clause) {
      query.clauses.push(clause);
      return this;
    },
    orderBy() {
      return this;
    },
    async getOne() {
      return saved.at(-1) || null;
    },
    async getMany() {
      return [];
    },
  };
  return {
    saved,
    query,
    create(value) {
      return value;
    },
    async save(value) {
      const row = { id: saved.length + 1, ...value };
      saved.push(row);
      return row;
    },
    async findOne({ where }) {
      if (where.id === 99) {
        return {
          id: 99,
          code: 'LSX-99',
          process_id: 7,
          parent_id: null,
          status: 'active',
        };
      }
      return saved.find((row) => row.id === where.id) || null;
    },
    createQueryBuilder() {
      return queryBuilder;
    },
  };
}

function stageRepository() {
  return {
    async findOne({ where }) {
      return where.id === 5
        ? { id: 5, name: 'Xả', type: 'supply', active: 1 }
        : null;
    },
  };
}

describe('OrdersController', () => {
  it('tạo lệnh sản xuất mà không tự sinh lệnh cung cấp', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    const result = await controller.create({
      code: 'LSX-01',
      process_id: 7,
      product_name: 'Hộp bia',
      quantity: 100,
      entry_date: '2026-08-11',
    });

    assert.equal(orders.saved.length, 1);
    assert.equal(orders.saved[0].parent_id, null);
    assert.equal(orders.saved[0].supply_type, null);
    assert.deepEqual(result.children, []);
  });

  it('tạo lệnh cung cấp Nhập lệnh gắn đúng lệnh sản xuất', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    await controller.createSupply({
      code: 'LCC-01',
      parent_id: 99,
      stage_id: 5,
      product_name: 'Giấy cuộn',
      quantity: 20,
      entry_date: '2026-08-11',
      supply_type: 'nhap_lenh',
    });

    assert.equal(orders.saved.length, 1);
    assert.equal(orders.saved[0].parent_id, 99);
    assert.equal(orders.saved[0].process_id, 7);
    assert.equal(orders.saved[0].supplier_name, null);
  });

  it('bắt buộc nhà cung cấp với lệnh Mua ngoài', async () => {
    const controller = new OrdersController(orderRepository(), stageRepository());

    await assert.rejects(
      controller.createSupply({
        code: 'LCC-02',
        parent_id: 99,
        stage_id: 5,
        product_name: 'Giấy cuộn',
        entry_date: '2026-08-11',
        supply_type: 'mua_ngoai',
      }),
      BadRequestException
    );
  });

  it('lưu nhà cung cấp với lệnh Mua ngoài', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    await controller.createSupply({
      code: 'LCC-03',
      parent_id: 99,
      stage_id: 5,
      product_name: 'Giấy cuộn',
      entry_date: '2026-08-11',
      supply_type: 'mua_ngoai',
      supplier_name: 'Công ty Giấy A',
    });

    assert.equal(orders.saved[0].supply_type, 'mua_ngoai');
    assert.equal(orders.saved[0].supplier_name, 'Công ty Giấy A');
  });

  it('bật tắt trạng thái lệnh sản xuất', async () => {
    const orders = orderRepository();
    const row = {
      id: 1,
      code: 'LSX-01',
      process_id: 7,
      product_name: 'Hộp bia',
      parent_id: null,
      status: 'active',
    };
    orders.saved.push(row);
    const controller = new OrdersController(orders, stageRepository());

    await controller.update('1', { status: 'inactive' });

    assert.equal(row.status, 'inactive');
  });

  it('áp dụng bộ lọc lệnh cung cấp, lệnh cha và trạng thái', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    await controller.list('1', '1', '99', 'active');

    assert.ok(orders.query.clauses.includes('o.parent_id IS NULL'));
    assert.ok(orders.query.clauses.includes('o.parent_id IS NOT NULL'));
    assert.ok(orders.query.clauses.includes('o.parent_id = :parentId'));
    assert.ok(orders.query.clauses.includes('o.status = :status'));
  });
});
