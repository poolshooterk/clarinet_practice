import { useCounterStore } from '@/store/counter';

describe('useCounterStore', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 });
  });

  it('initial count is 0', () => {
    expect(useCounterStore.getState().count).toBe(0);
  });

  it('increment / decrement update count correctly', () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();
    useCounterStore.getState().decrement();
    expect(useCounterStore.getState().count).toBe(1);
  });

  it('reset() returns count to 0', () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().reset();
    expect(useCounterStore.getState().count).toBe(0);
  });
});
