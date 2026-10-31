(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NavigationSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const byId = list => new Map(list.map(x => [String(x.id), x]));

  // Independent fields merge independently. Conflicting deletion/edit or same-field
  // edits require a user choice; timestamps never silently decide a winner.
  function merge(base, local, remote, preference) {
    const maps = [base, local, remote].map(byId);
    const ids = [...new Set([...remote, ...local, ...base].map(x => String(x.id)))];
    const entries = [], conflicts = [];
    for (const id of ids) {
      const [b, l, r] = maps.map(m => m.get(id));
      if (same(l, r)) { if (l) entries.push(clone(l)); continue; }
      if (same(b, l)) { if (r) entries.push(clone(r)); continue; }
      if (same(b, r)) { if (l) entries.push(clone(l)); continue; }
      if (!l || !r || !b) {
        conflicts.push({id, name: (l || r || b).name, field: '整条收藏'});
        const chosen = preference === 'remote' ? r : l;
        if (chosen) entries.push(clone(chosen));
        continue;
      }
      const result = {};
      for (const field of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        let chosen;
        if (same(l[field], r[field]) || same(b[field], r[field])) chosen = l[field];
        else if (same(b[field], l[field])) chosen = r[field];
        else {
          conflicts.push({id, name: l.name || r.name, field});
          chosen = preference === 'remote' ? r[field] : l[field];
        }
        if (chosen !== undefined) result[field] = chosen;
      }
      entries.push(result);
    }
    return {entries, conflicts};
  }

  class Engine {
    constructor({userId, remote, storage, validate, onChange = () => {}, onStatus = () => {}, onConflict = () => {}}) {
      Object.assign(this, {userId, remote, storage, validate, onChange, onStatus, onConflict});
      this.key = 'tianhao-nav-cloud-v1:' + userId;
      this.state = {entries: [], previous: null, base: [], revision: null, dirty: false};
      this.active = true; this.ready = false; this.seq = 0; this.running = null; this.timer = null; this.conflict = null;
      try {
        const cached = JSON.parse(storage.getItem(this.key) || 'null');
        if (cached && validate(cached.entries) && validate(cached.base) &&
          (cached.revision === null || Number.isSafeInteger(cached.revision)) && typeof cached.dirty === 'boolean') {
          this.state = {...cached, previous: validate(cached.previous) ? cached.previous : null};
          this.ready = true;
        }
      } catch { /* A corrupt cache never replaces cloud data. */ }
    }
    emit() { if (this.active) this.onChange(clone(this.state)); }
    status(text, kind = '') { if (this.active) this.onStatus(text, kind); }
    persist(next) { this.storage.setItem(this.key, JSON.stringify(next)); this.state = next; }
    commit(entries, previous = this.state.entries) {
      if (!this.active || !this.ready || this.conflict || !this.validate(entries)) return false;
      try {
        this.persist({...this.state, entries: clone(entries), previous: clone(previous), dirty: true});
      } catch { this.status('本地保存失败，请导出备份后重试。', 'error'); return false; }
      this.seq++; this.emit(); this.status('已保存在这台电脑，等待同步…', 'pending'); this.schedule(); return true;
    }
    undo() { return this.state.previous && this.commit(this.state.previous, null); }
    schedule() {
      clearTimeout(this.timer);
      if (this.active && !this.conflict) this.timer = setTimeout(() => this.sync(), 350);
    }
    async sync() {
      if (!this.active || this.conflict) return false;
      if (this.running) return this.running;
      this.running = this.run().finally(() => { this.running = null; });
      return this.running;
    }
    async run() {
      try {
        this.status('正在同步…', 'pending');
        for (let attempt = 0; attempt < 4 && this.active; attempt++) {
          const remote = await this.remote.read();
          if (!this.active) return false;
          if (!remote || !this.validate(remote.entries) ||
            !(remote.revision === null || Number.isSafeInteger(remote.revision))) throw Error('云端内容格式不正确，请保留备份并联系维护者。');
          this.ready = true;
          if (!this.state.dirty) {
            const next = {entries: clone(remote.entries), previous: null, base: clone(remote.entries), revision: remote.revision, dirty: false};
            this.persist(next); this.emit(); this.status('已与云端同步'); return true;
          }
          const localAtSend = clone(this.state.entries);
          let sent = clone(localAtSend);
          if (remote.revision !== this.state.revision) {
            const merged = merge(this.state.base, sent, remote.entries);
            if (merged.conflicts.length) {
              this.conflict = {remote: clone(remote), conflicts: merged.conflicts};
              this.status('检测到同时修改，请选择保留哪一份冲突内容。', 'conflict');
              this.onConflict(clone(merged.conflicts)); return false;
            }
            sent = merged.entries;
          }
          const seq = this.seq;
          const saved = same(sent, remote.entries) ? remote : await this.remote.write(sent, remote.revision);
          if (!this.active) return false;
          if (!saved) continue; // Another device won the compare-and-swap: refetch and merge.
          if (this.seq !== seq) {
            // Preserve edits made while the request was in flight. Fold remote-only
            // changes into those edits rather than replacing the user's current draft.
            const merged = merge(localAtSend, this.state.entries, sent);
            if (merged.conflicts.length) {
              this.conflict = {remote: clone(saved), base: localAtSend, conflicts: merged.conflicts};
              this.onConflict(clone(merged.conflicts)); return false;
            }
            this.persist({...this.state, entries: merged.entries, base: clone(sent), revision: saved.revision, dirty: true});
            this.emit(); continue;
          }
          this.persist({...this.state, entries: clone(sent), base: clone(sent), revision: saved.revision, dirty: false});
          this.emit(); this.status('已与云端同步'); return true;
        }
        this.status('其他设备仍在修改，稍后重试；本机修改已保留。', 'pending'); return false;
      } catch (error) {
        if (!this.active) return false;
        this.emit();
        this.status(this.state.dirty ? '暂未同步，本机修改已保留。请联网后点“同步”。' : (error.message || '无法连接云端，请重试。'), 'error');
        return false;
      }
    }
    resolve(preference) {
      if (!this.conflict || !['local', 'remote'].includes(preference)) return false;
      const remote = this.conflict.remote;
      const merged = merge(this.conflict.base || this.state.base, this.state.entries, remote.entries, preference);
      try {
        this.persist({...this.state, entries: merged.entries, previous: clone(this.state.entries), base: remote.entries, revision: remote.revision, dirty: true});
      } catch { this.status('本地保存失败，冲突内容仍保留。', 'error'); return false; }
      this.conflict = null; this.seq++; this.emit(); this.schedule(); return true;
    }
    stop() { this.active = false; clearTimeout(this.timer); }
  }
  return {Engine, merge};
});
