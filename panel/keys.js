// Клавиши: таблица сочетаний, последовательности и двойные нажатия, запуск команд.
import {
  COMMAND, DOUBLE_WAIT, MODIFIER_KEYS, SEQUENCE_WAIT, chordOf, physicalChordOf, preferPhysical,
  resolveKeymap,
} from '../commands.js';
import { state } from './state.js';
import { cancelPending } from './keymap.js';
import { dialogOpen, isEditing } from './ui.js';
import { actions } from './actions.js';

// Таблица «сочетание → команда» (state.bindings, из настроек или по умолчанию) и начала
// последовательностей: «g» для «g g», «Enter» для «Enter Enter». Для каждого начала
// запоминаем, сколько ждать продолжения: двойное нажатие — недолго, иначе дольше.
let waits = new Map();
export function buildKeymap() {
  cancelPending();
  state.bindings = new Map();
  waits = new Map();
  state.resolved = resolveKeymap(state.keymap);
  for (const [id, keys] of state.resolved) {
    for (const binding of keys) {
      state.bindings.set(binding, id);
      const parts = binding.split(' ');
      for (let i = 1; i < parts.length; i++) {
        const prefix = parts.slice(0, i).join(' ');
        const wait = parts[i] === parts[i - 1] ? DOUBLE_WAIT : SEQUENCE_WAIT;
        waits.set(prefix, Math.max(waits.get(prefix) ?? 0, wait));
      }
    }
  }
}

// repeat — команда повторяется из удержанной клавиши (см. onKey)
export function runCommand(id, { repeat = false } = {}) {
  if (isEditing() || dialogOpen() || state.preparing) return; // пока ждали продолжения, открылось окно
  actions[id]?.({ repeat });
}

function onKey(e) {
  const typed = chordOf(e);
  if (!typed) return; // нажали только модификатор
  // Знак, который на этой раскладке ничего не значит (точка на месте «/» в русской),
  // или любой знак на нелатинской раскладке — понимаем по месту клавиши
  const physical = physicalChordOf(e);
  const known = (seq) => state.bindings.has(seq) || waits.has(seq);
  const seqAfter = (prefix) => {
    const join = (chord) => (prefix ? `${prefix} ${chord}` : chord);
    if (!physical || !known(join(physical))) return join(typed);
    return preferPhysical(e) || !known(join(typed)) ? join(physical) : join(typed);
  };

  // Удержание клавиши повторяет только «повторяемые» команды (стрелки)
  // и никогда не складывается в последовательность или двойное нажатие
  if (e.repeat) {
    const chord = seqAfter('');
    const command = state.bindings.get(chord);
    if (state.pending || waits.has(chord)) return e.preventDefault();
    if (!command) return;
    e.preventDefault();
    if (COMMAND[command].repeat) runCommand(command, { repeat: true });
    return;
  }

  let seq = seqAfter('');
  if (state.pending) {
    const longer = seqAfter(state.pending.seq);
    const waiting = state.pending.command;
    cancelPending();
    if (known(longer)) {
      seq = longer;
    } else if (typed === 'Escape') {
      return e.preventDefault(); // Esc посреди сочетания — просто отмена, как в Vim
    } else if (waiting) {
      runCommand(waiting); // продолжения не случилось — выполняем то, что ждало
      if (isEditing() || dialogOpen()) return e.preventDefault(); // и не отдаём клавишу открывшемуся полю
    }
  }

  const command = state.bindings.get(seq);
  if (waits.has(seq)) {
    // Начало более длинного сочетания — ждём продолжения. Коротко — только если у этой
    // клавиши есть своё действие (иначе оно бы тормозило); без него спешить некуда.
    state.pending = {
      seq, command,
      timer: setTimeout(() => {
        const waiting = state.pending?.command;
        state.pending = null;
        if (waiting) runCommand(waiting);
      }, command ? waits.get(seq) : SEQUENCE_WAIT),
    };
    return e.preventDefault();
  }
  // пробел без команды не прокручивает список (например, Shift+пробел после Shift+↓)
  if (!command) return void (/^(Shift\+)?Space$/.test(typed) && e.preventDefault());
  e.preventDefault();
  runCommand(command);
}

// Удержанная клавиша не действует там, куда фокус перешёл от её же нажатия:
// R не печатает «rrr» в поле названия, Enter не жмёт «Удалить» в только что открытом окне
let pressedOn = null;

export function listenKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || isEditing() || dialogOpen()) return;
    if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return; // кнопки (в сообщении)
    onKey(e);
  });

  // Пока создаётся новая папка, напечатанное — её будущее название, а не команды
  document.addEventListener('keydown', (e) => {
    if (!state.typeAhead || e.target.closest?.('input, dialog')) return;
    if (e.isComposing || MODIFIER_KEYS.has(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || state.typeAhead.enter || state.typeAhead.cancel) return; // после Enter или Esc название уже решено
    if (e.key === 'Enter') state.typeAhead.enter = true;
    else if (e.key === 'Escape') state.typeAhead.cancel = true;
    else if (e.key === 'Backspace') state.typeAhead.text = state.typeAhead.text.slice(0, -1);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) state.typeAhead.text += e.key;
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!e.repeat) pressedOn = e.target;
    else if (e.target !== pressedOn) e.preventDefault();
  }, true);

  window.addEventListener('blur', cancelPending);
  document.addEventListener('mousedown', cancelPending, true); // клик прерывает начатое сочетание
}
