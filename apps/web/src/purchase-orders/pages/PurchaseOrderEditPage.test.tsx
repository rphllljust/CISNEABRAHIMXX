import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers';
import {
  COMMERCIAL_DEMO_IDS,
  createCommercialFetchMock,
} from '../../test/commercial-fetch-mock';
import { resetTokenStoreForTests, tokenStore } from '../../auth/storage/token-store';
import { PurchaseOrderEditPage } from './PurchaseOrderEditPage';

function renderEdit() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/purchase-orders/:purchaseOrderId/edit" element={<PurchaseOrderEditPage />} />
    </Routes>,
    {
      router: {
        initialEntries: [`/app/purchase-orders/${COMMERCIAL_DEMO_IDS.DEMO_PO_ID}/edit`],
      },
    },
  );
}

describe('PurchaseOrderEditPage', () => {
  beforeEach(() => {
    resetTokenStoreForTests();
    tokenStore.setTokens('access-token', 'refresh-token');
    vi.unstubAllGlobals();
  });

  it('identifies the edited purchase order and links back to the object page', async () => {
    vi.stubGlobal('fetch', createCommercialFetchMock());
    renderEdit();

    expect(
      await screen.findByRole('heading', { name: /editar PO-2026-DEMO01/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pedido PO-CLIENTE-001 em rascunho/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao detalhe/i })).toHaveAttribute(
      'href',
      `/app/purchase-orders/${COMMERCIAL_DEMO_IDS.DEMO_PO_ID}`,
    );
  });
});
