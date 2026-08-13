const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { OrdersController } = require('../dist/modules/orders/orders.controller');

function orderRepository() {
  const saved = [];
  const query = { clauses: [] };
  const parentsById = {
    99: {
      id: 99,
      code: 'LSX-99',
      process_id: 7,
      parent_id: null,
      status: 'active',
    },
    100: {
      id: 100,
      code: 'LSX-100',
      process_id: 7,
      parent_id: null,
      status: 'active',
    },
  };
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
    async find({ where }) {
      const ids = where?.id?._value || [];
      return ids.map((id) => parentsById[id]).filter(Boolean);
    },
    async findOne({ where }) {
      if (parentsById[where.id]) return parentsById[where.id];
      return saved.find((row) => row.id === where.id) || null;
    },
    createQueryBuilder() {
      return queryBuilder;
    },
  };
}

function stageRepository() {
  const byId = {
    5: { id: 5, name: 'Xả', type: 'supply', active: 1 },
    6: { id: 6, name: 'Sóng', type: 'supply', active: 1 },
  };
  return {
    async findOne({ where }) {
      return byId[where.id] || null;
    },
    async find({ where }) {
      const ids = where?.id?._value || [];
      return ids.map((id) => byId[id]).filter(Boolean);
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

  it('tạo lệnh sản xuất kèm lệnh cung cấp Xả/Sóng', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    await controller.create({
      code: 'LSX-01',
      process_id: 7,
      product_name: 'Hộp bia',
      quantity: 100,
      entry_date: '2026-08-11',
      children: [
        { code: 'LSX-01-Xả', stage_id: 5, product_name: 'Giấy xả' },
        { code: 'LSX-01-Sóng', stage_id: 6, product_name: 'Giấy sóng' },
      ],
    });

    assert.equal(orders.saved.length, 3);
    assert.equal(orders.saved[0].supply_type, null);
    assert.equal(orders.saved[1].parent_id, 1);
    assert.deepEqual(orders.saved[1].parent_ids, [1]);
    assert.equal(orders.saved[1].stage_id, 5);
    assert.equal(orders.saved[1].product_name, 'Giấy xả');
    assert.equal(orders.saved[2].stage_id, 6);
    assert.equal(orders.saved[2].product_name, 'Giấy sóng');
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
    assert.deepEqual(orders.saved[0].parent_ids, [99]);
    assert.equal(orders.saved[0].process_id, 7);
    assert.equal(orders.saved[0].supplier_name, null);
  });

  it('tạo lệnh cung cấp gắn nhiều lệnh sản xuất', async () => {
    const orders = orderRepository();
    const controller = new OrdersController(orders, stageRepository());

    await controller.createSupply({
      code: 'LCC-MULTI',
      parent_ids: [99, 100],
      stage_id: 5,
      product_name: 'Giấy cuộn',
      quantity: 20,
      entry_date: '2026-08-11',
      supply_type: 'nhap_lenh',
    });

    assert.deepEqual(orders.saved[0].parent_ids, [99, 100]);
    assert.equal(orders.saved[0].parent_id, 99);
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

  it('cập nhật lệnh cung cấp với nhiều lệnh sản xuất', async () => {
    const orders = orderRepository();
    const row = {
      id: 1,
      code: 'LCC-01',
      process_id: 7,
      product_name: 'Giấy cũ',
      quantity: 10,
      entry_date: '2026-08-01',
      parent_id: 99,
      parent_ids: [99],
      stage_id: 5,
      supply_type: 'nhap_lenh',
      supplier_name: null,
      status: 'active',
    };
    orders.saved.push(row);
    const controller = new OrdersController(orders, stageRepository());

    await controller.update('1', {
      code: 'LCC-01B',
      parent_ids: [99, 100],
      stage_id: 5,
      product_name: 'Giấy mới',
      quantity: 30,
      entry_date: '2026-08-11',
      supply_type: 'mua_ngoai',
      supplier_name: 'NCC A',
    });

    assert.equal(row.code, 'LCC-01B');
    assert.equal(row.product_name, 'Giấy mới');
    assert.deepEqual(row.parent_ids, [99, 100]);
    assert.equal(row.parent_id, 99);
    assert.equal(row.supply_type, 'mua_ngoai');
    assert.equal(row.supplier_name, 'NCC A');
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
    assert.ok(
      orders.query.clauses.includes('(o.parent_id = :parentId OR :parentId = ANY(o.parent_ids))')
    );
    assert.ok(orders.query.clauses.includes('o.status = :status'));
  });
});
