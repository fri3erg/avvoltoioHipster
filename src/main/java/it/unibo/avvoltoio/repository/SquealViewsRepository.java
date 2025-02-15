package it.unibo.avvoltoio.repository;

import it.unibo.avvoltoio.domain.SquealViews;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data MongoDB repository for the SquealViews entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SquealViewsRepository extends MongoRepository<SquealViews, String> {
    Optional<SquealViews> findFirstBySqueal__id(String id);
}
