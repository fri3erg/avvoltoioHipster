package it.unibo.avvoltoio.domain;

import it.unibo.avvoltoio.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class SMMUserTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(SMMUser.class);
    }
}