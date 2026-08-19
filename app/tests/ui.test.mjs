import { chromium } from 'playwright';

// A stand-in server that enforces the same money rules the real functions do,
// so the UI is exercised against refusals as well as happy paths.
const makeState = role => ({
  me: { name: role === 'parent' ? 'Dad' : 'Ella', role },
  pot: 30000, items: [
    { id:'n1', bucket:'need', name:'Glow Recipe dew drops', price_cents:3400, currency:'USD',
      image_url:null, source_url:'https://sephora.com/x', source_site:'sephora.com', notes:null,
      priority:1, sort_order:0, entry_method:'auto', status:'open', created_at:'2026-08-01' },
    { id:'n2', bucket:'need', name:'CeraVe cleanser', price_cents:1699, currency:'USD',
      image_url:null, source_url:null, source_site:'target.com', notes:null,
      priority:2, sort_order:1, entry_method:'manual', status:'open', created_at:'2026-08-02' },
    { id:'g1', bucket:'goal', name:'Canon Sure Shot', price_cents:18500, currency:'USD',
      image_url:null, source_url:null, source_site:'ebay.com', notes:null,
      priority:1, sort_order:0, entry_method:'auto', status:'open', created_at:'2026-08-03' },
  ],
  ledger: [
    { id:'l1', item_id:null, link_id:'p1', source:'teen', kind:'deposit', amount_cents:6000,
      fulfilled_at:null, note:'Babysitting', created_at:'2026-08-02' },
    { id:'l2', item_id:'g1', link_id:'p1', source:'teen', kind:'allocate', amount_cents:4000,
      fulfilled_at:null, note:null, created_at:'2026-08-03' },
  ],
  people: { p1:'Ella', p2:'Dad' },
});
const derive = s => {
  s.balance = s.ledger.reduce((n,e)=> e.source!=='teen'?n : e.kind==='deposit'?n+e.amount_cents
    : e.kind==='allocate'?n-e.amount_cents : n, 0);
  s.pledged = s.ledger.reduce((n,e)=> e.kind==='pledged'?n+e.amount_cents:n, 0);
  return s;
};

const errs = [];
const browser = await chromium.launch();

async function session(role) {
  const state = derive(makeState(role));
  const page = await browser.newPage({ viewport:{width:414,height:900}, deviceScaleFactor:2 });
  page.on('pageerror', e => errs.push(`[${role}] PAGEERROR ${e.message}`));
  page.on('console', m => { if (m.type()==='error' && !/font|ERR_CONNECTION|manifest|icon/i.test(m.text())) errs.push(`[${role}] ${m.text()}`); });

  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON?.() ?? {};
    const ok = () => (state.items.sort((a,b)=>a.priority-b.priority||a.sort_order-b.sort_order), route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(derive(state)) }));
    const bad = msg => route.fulfill({ status:400, contentType:'application/json', body:JSON.stringify({error:msg}) });

    if (url.pathname === '/api/state') { state.items.sort((a,b)=>a.priority-b.priority||a.sort_order-b.sort_order); return ok(); }
    if (url.pathname === '/api/scrape') return route.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify(/depop/.test(body.url)
        ? { name:'Vintage Carhartt jacket', price_cents:5400, currency:'USD', image_url:null,
            source_site:'depop.com', source_url:body.url, confidence:1 }
        : { name:null, price_cents:null, currency:'USD', image_url:null,
            source_site:'instagram.com', source_url:body.url, confidence:0 }) });

    if (url.pathname === '/api/item') {
      if (body.action==='create') state.items.unshift({ id:'new'+state.items.length, priority:body.fields.priority,
        sort_order:0, status:'open', currency:'USD', notes:null, image_url:null, created_at:'now', ...body.fields });
      if (body.action==='update') Object.assign(state.items.find(i=>i.id===body.id), body.fields);
      if (body.action==='delete') {
        state.ledger = state.ledger.flatMap(e => e.item_id!==body.id ? [e]
          : e.kind==='direct' ? [{...e, item_id:null, kind:'deposit'}] : []);
        state.items = state.items.filter(i=>i.id!==body.id);
      }
      if (body.action==='status') {
        const allowed = state.me.role==='parent' ? ['approved','declined','open'] : ['purchased','open'];
        if (!allowed.includes(body.status)) return route.fulfill({status:403,contentType:'application/json',
          body:JSON.stringify({error:'Not a status you can set'})});
        state.items.find(i=>i.id===body.id).status = body.status;
      }
      if (body.action==='move') {
        const it = state.items.find(i=>i.id===body.id);
        const list = state.items.filter(i=>i.bucket===it.bucket).sort((a,b)=>a.priority-b.priority||a.sort_order-b.sort_order);
        const i = list.findIndex(x=>x.id===it.id), j = i+body.dir;
        if (j>=0 && j<list.length) {
          const other = list[j];
          if (other.priority!==it.priority) it.priority = other.priority;
          [list[i], list[j]] = [list[j], list[i]];
          list.forEach((x,k)=>{ x.sort_order = k; });
        }
      }
      return ok();
    }
    if (url.pathname === '/api/money') {
      const amt = body.amountCents;
      if (body.action==='setPot') state.pot = amt;
      if (body.action==='deposit') state.ledger.push({id:'d'+state.ledger.length,item_id:null,link_id:'p1',
        source:'teen',kind:'deposit',amount_cents:amt,fulfilled_at:null,note:body.note,created_at:'now'});
      if (body.action==='allocate') {
        if (amt > 0 && amt > derive(state).balance) return bad("That's more than she has saved");
        state.ledger.push({id:'a'+state.ledger.length,item_id:body.itemId,link_id:'p1',
          source:'teen',kind:'allocate',amount_cents:amt,fulfilled_at:null,note:null,created_at:'now'});
      }
      if (body.action==='pledge') state.ledger.push({id:'p'+state.ledger.length,item_id:body.itemId,link_id:'p2',
        source:'parent',kind:'pledged',amount_cents:amt,fulfilled_at:null,note:null,created_at:'now'});
      return ok();
    }
    return route.fulfill({ status:404, body:'{}' });
  });

  await page.goto('http://localhost:4173/#t=TESTTOKEN');
  await page.waitForTimeout(500);
  return { page, state };
}

const check = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);

// ---------- her phone ----------
const { page, state } = await session('teen');
check('token is stripped from the address bar', !page.url().includes('t=TESTTOKEN'));
check('her list renders', (await page.locator('.tile').count()) === 2);
await page.screenshot({ path:'/tmp/dm-A1-needs.png' });

// add via a link that scrapes
await page.click('.add');
await page.fill('#root input', 'https://depop.com/products/carhartt');
await page.locator('.field input').first().blur();
await page.waitForTimeout(300);
const nameField = await page.locator('.field input').nth(1).inputValue();
check('a readable link fills the name in', nameField === 'Vintage Carhartt jacket');
await page.screenshot({ path:'/tmp/dm-A2-add-filled.png' });

// a blocked link leaves the form exactly as it was
await page.click('.back');
await page.click('.add');
await page.fill('#root input', 'https://instagram.com/shop/xyz');
await page.locator('.field input').first().blur();
await page.waitForTimeout(300);
check('a blocked link shows no error surface', (await page.locator('.err').count()) === 0);
check('a blocked link leaves the name empty', (await page.locator('.field input').nth(1).inputValue()) === '');
await page.screenshot({ path:'/tmp/dm-A3-add-blocked.png' });
await page.click('.back');

// list view: reorder + priority
await page.getByRole('button',{name:'List',exact:true}).click();
await page.waitForTimeout(200);
const order = () => page.$$eval('.rname', els => els.map(e => e.textContent));
const before = await order();
await page.locator('.arrows button').nth(2).click();   // second row, up
await page.waitForTimeout(300);
const after = await order();
check('moving up past a band reorders the list', JSON.stringify(before) !== JSON.stringify(after));
await page.screenshot({ path:'/tmp/dm-A4-list.png' });

// delete, with the money warning
await page.getByRole('button',{name:/^Goals/}).click();
await page.waitForTimeout(200);
await page.getByRole('button',{name:'List',exact:true}).click();
await page.waitForTimeout(200);
await page.locator('.del').first().click();
await page.waitForTimeout(250);
const warning = await page.locator('.sheet .sub').textContent();
check('delete warns about the money on it', /\$40/.test(warning ?? ''));
await page.screenshot({ path:'/tmp/dm-A5-delete-warning.png' });
await page.getByRole('button',{name:'Keep it'}).click();

// savings: deposit through the sheet
await page.getByRole('button',{name:/My list|Savings/}).last().click();
await page.waitForTimeout(400);
check('savings screen opens', (await page.getByRole('button',{name:'Add money'}).count()) === 1);
await page.getByRole('button',{name:'Add money'}).click();
await page.fill('.sheet .big', '25');
await page.getByRole('button',{name:'Add it'}).click();
await page.waitForTimeout(400);
check('a deposit raises the balance to $45', (await page.locator('p.num').first().textContent())?.includes('45'));
await page.screenshot({ path:'/tmp/dm-A6-savings.png' });

// allocating more than she has is refused
await page.click('.back');
await page.getByRole('button',{name:/^Goals/}).click();
await page.waitForTimeout(200);
await page.getByRole('button',{name:'Grid',exact:true}).click();
await page.click('.goal');
await page.waitForTimeout(250);
await page.getByRole('button',{name:'Use her savings'}).click();
await page.fill('.sheet .big', '999');
await page.getByRole('button',{name:'Move it'}).click();
await page.waitForTimeout(300);
check('over-spending her balance is refused', (await page.locator('.err').count()) === 1);
await page.screenshot({ path:'/tmp/dm-A7-refused.png' });

// the refusal sheet is still open from the previous check; close it first
await page.getByRole('button',{name:'Cancel'}).click();
await page.waitForTimeout(200);

// marking something bought archives it rather than deleting it
await page.getByRole('button',{name:/My list/}).click();
await page.waitForTimeout(250);
await page.getByRole('button',{name:/^Needs/}).click();
await page.getByRole('button',{name:'Grid',exact:true}).click();
await page.waitForTimeout(250);
const beforeCount = await page.locator('.tile').count();
await page.locator('.tile').first().click();
await page.waitForTimeout(300);
await page.getByRole('button',{name:'Got it — I bought this'}).click();
await page.waitForTimeout(450);
check('a bought item leaves the open list', (await page.locator('.tile').count()) === beforeCount - 1);
check('a bought item lands on the Got it shelf', (await page.getByRole('button',{name:/^Got it ·/}).count()) === 1);
await page.getByRole('button',{name:/^Got it ·/}).click();
await page.waitForTimeout(250);
await page.screenshot({ path:'/tmp/dm-A10-got-it.png' });

// notes save on blur
await page.locator('.led .ropen').first().click();
await page.waitForTimeout(300);
await page.fill('textarea', 'the 30ml one, not the mini');
await page.locator('textarea').blur();
await page.waitForTimeout(450);
check('a note is saved', state.items.some(i => i.notes === 'the 30ml one, not the mini'));

// ---------- parent ----------
const { page: pp } = await session('parent');
check('parent lands on the pot', (await pp.locator('.money .cap').first().textContent()) === 'The pot');
check('parent has no add button', (await pp.locator('.add').count()) === 0);
await pp.screenshot({ path:'/tmp/dm-A8-parent.png' });
await pp.getByRole('button',{name:'Pledge from the pot'}).first().click();
await pp.fill('.sheet .big', '400');
await pp.getByRole('button',{name:'Pledge it'}).click();
await pp.waitForTimeout(400);
check('over-pledging the pot is allowed and flagged', (await pp.locator('.warn').count()) === 1);
await pp.screenshot({ path:'/tmp/dm-A9-parent-over.png' });

check('a parent is never offered "I bought this"',
  (await pp.getByRole('button',{name:'Got it — I bought this'}).count()) === 0);

await pp.emulateMedia({ colorScheme:'dark' });
await pp.waitForTimeout(200);
await pp.screenshot({ path:'/tmp/dm-B1-parent-dark.png' });

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check('no horizontal overflow', !overflow);
console.log(errs.length ? '\n' + errs.join('\n') : '\nno console errors');
await browser.close();
