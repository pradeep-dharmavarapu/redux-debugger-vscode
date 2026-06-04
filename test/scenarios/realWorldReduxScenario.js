const initialState = {
  auth: {
    user: null,
    token: null,
  },
  cart: {
    items: [],
    coupon: null,
    totals: {
      subtotal: 0,
      discount: 0,
      grandTotal: 0,
    },
  },
  todos: {
    items: [],
    filter: 'all',
  },
  search: {
    query: '',
    results: [],
    loading: false,
    error: null,
  },
  dashboard: {
    widgets: [],
    selectedWidgetId: null,
  },
  performance: {
    tick: 0,
    samples: [],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recalculateTotals(items, coupon) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = coupon === 'SAVE10' ? Math.round(subtotal * 0.1) : 0;
  return {
    subtotal,
    discount,
    grandTotal: subtotal - discount,
  };
}

function rootReducer(state = initialState, action) {
  switch (action.type) {
    case 'auth/loginFulfilled':
      return {
        ...state,
        auth: {
          user: action.payload.user,
          token: action.payload.token,
        },
      };

    case 'cart/itemAdded': {
      const items = [...state.cart.items, action.payload];
      return {
        ...state,
        cart: {
          ...state.cart,
          items,
          totals: recalculateTotals(items, state.cart.coupon),
        },
      };
    }

    case 'cart/quantityChanged': {
      const items = state.cart.items.map(item =>
        item.sku === action.payload.sku
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      return {
        ...state,
        cart: {
          ...state.cart,
          items,
          totals: recalculateTotals(items, state.cart.coupon),
        },
      };
    }

    case 'todos/todoAdded':
      return {
        ...state,
        todos: {
          ...state.todos,
          items: [
            ...state.todos.items,
            {
              id: action.payload.id,
              title: action.payload.title,
              completed: false,
              project: action.payload.project,
            },
          ],
        },
      };

    case 'todos/todoCompleted':
      return {
        ...state,
        todos: {
          ...state.todos,
          items: state.todos.items.map(todo =>
            todo.id === action.payload.id ? { ...todo, completed: true } : todo
          ),
        },
      };

    case 'search/queryChanged':
      return {
        ...state,
        search: {
          ...state.search,
          query: action.payload.query,
          loading: true,
          error: null,
        },
      };

    case 'search/resultsFulfilled':
      return {
        ...state,
        search: {
          ...state.search,
          results: action.payload.results,
          loading: false,
        },
      };

    case 'dashboard/widgetsLoaded':
      return {
        ...state,
        dashboard: {
          widgets: action.payload,
          selectedWidgetId: action.payload[0]?.id ?? null,
        },
      };

    case 'perf/tick':
      return {
        ...state,
        performance: {
          tick: state.performance.tick + 1,
          samples: [
            ...state.performance.samples.slice(-24),
            {
              index: action.payload.index,
              at: action.payload.at,
              value: action.payload.value,
            },
          ],
        },
      };

    default:
      return state;
  }
}

function createRealWorldStore(middlewares = []) {
  let state = clone(initialState);
  const store = {
    getState: () => state,
    dispatch: action => dispatch(action),
  };

  const baseDispatch = action => {
    state = rootReducer(state, action);
    return action;
  };

  const dispatch = middlewares
    .slice()
    .reverse()
    .reduce((next, middleware) => middleware(store)(next), baseDispatch);

  return store;
}

function dispatchRealWorldScenario(store) {
  store.dispatch({
    type: 'auth/loginFulfilled',
    payload: {
      user: {
        id: 'user-42',
        name: 'Pradeep Kumar',
        role: 'Frontend Architect',
      },
      token: 'secret-jwt-token',
      password: 'never-send-this',
    },
  });

  store.dispatch({
    type: 'cart/itemAdded',
    payload: {
      sku: 'SKU-REDUX-HOODIE',
      name: 'Redux Hoodie',
      price: 64,
      quantity: 1,
    },
  });

  store.dispatch({
    type: 'cart/quantityChanged',
    payload: {
      sku: 'SKU-REDUX-HOODIE',
      quantity: 2,
    },
  });

  store.dispatch({
    type: 'todos/todoAdded',
    payload: {
      id: 'todo-1',
      title: 'Profile Redux state debugger in a real app',
      project: 'marketplace-launch',
    },
  });

  store.dispatch({
    type: 'todos/todoCompleted',
    payload: {
      id: 'todo-1',
    },
  });

  store.dispatch({
    type: 'search/queryChanged',
    payload: {
      query: 'memoized selector regression',
    },
  });

  store.dispatch({
    type: 'search/resultsFulfilled',
    payload: {
      results: [
        { id: 'r1', title: 'Cart selector recalculates on every render', score: 0.92 },
        { id: 'r2', title: 'Dashboard widget payload causes slow reducer', score: 0.81 },
      ],
    },
  });

  store.dispatch({
    type: 'dashboard/widgetsLoaded',
    payload: Array.from({ length: 6 }, (_, index) => ({
      id: `widget-${index + 1}`,
      title: `Revenue segment ${index + 1}`,
      metrics: {
        views: 1200 + index * 137,
        conversions: 80 + index * 9,
        latencyMs: 18 + index,
      },
    })),
  });
}

function dispatchBurstScenario(store, count) {
  for (let index = 0; index < count; index++) {
    store.dispatch({
      type: 'perf/tick',
      payload: {
        index,
        at: 1_770_000_000_000 + index,
        value: Math.round(Math.sin(index / 8) * 1000) / 100,
      },
    });
  }
}

module.exports = {
  createRealWorldStore,
  dispatchRealWorldScenario,
  dispatchBurstScenario,
};
