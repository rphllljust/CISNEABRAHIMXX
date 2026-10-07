import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers';
import {
  COMMERCIAL_DEMO_IDS,
  createCommercialFetchMock,
} from '../../test/commercial-fetch-mock';
import { resetTokenStoreForTests, tokenStore } from '../../auth/storage/token-store';
import { ProposalEditPage } from './ProposalEditPage';

function renderEdit() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/proposals/:proposalId/edit" element={<ProposalEditPage />} />
    </Routes>,
    {
      router: {
        initialEntries: [`/app/proposals/${COMMERCIAL_DEMO_IDS.DEMO_PROPOSAL_ID}/edit`],
      },
    },
  );
}

describe('ProposalEditPage', () => {
  beforeEach(() => {
    resetTokenStoreForTests();
    tokenStore.setTokens('access-token', 'refresh-token');
    vi.unstubAllGlobals();
  });

  it('identifies the edited proposal and links back to the object page', async () => {
    vi.stubGlobal('fetch', createCommercialFetchMock());
    renderEdit();

    expect(
      await screen.findByRole('heading', { name: /editar PROP-2026-DEMO01/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/proposta de serviços — rascunho da versão 1/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao detalhe/i })).toHaveAttribute(
      'href',
      `/app/proposals/${COMMERCIAL_DEMO_IDS.DEMO_PROPOSAL_ID}`,
    );

  });
});
