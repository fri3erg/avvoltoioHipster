package it.unibo.avvoltoio.web.rest;

import it.unibo.avvoltoio.domain.Channel;
import it.unibo.avvoltoio.repository.ChannelRepository;
import it.unibo.avvoltoio.web.rest.errors.BadRequestAlertException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.ResponseUtil;

/**
 * REST controller for managing {@link it.unibo.avvoltoio.domain.Channel}.
 */
@RestController
@RequestMapping("/api")
public class ChannelResource {

    private final Logger log = LoggerFactory.getLogger(ChannelResource.class);

    private static final String ENTITY_NAME = "channel";

    @Value("${jhipster.clientApp.name}")
    private String applicationName;

    private final ChannelRepository channelRepository;

    public ChannelResource(ChannelRepository channelRepository) {
        this.channelRepository = channelRepository;
    }

    /**
     * {@code POST  /channels} : Create a new channel.
     *
     * @param channel the channel to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new channel, or with status {@code 400 (Bad Request)} if the channel has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("/channels")
    public ResponseEntity<Channel> createChannel(@RequestBody Channel channel) throws URISyntaxException {
        log.debug("REST request to save Channel : {}", channel);
        if (channel.getId() != null) {
            throw new BadRequestAlertException("A new channel cannot already have an ID", ENTITY_NAME, "idexists");
        }
        Channel result = channelRepository.save(channel);
        return ResponseEntity
            .created(new URI("/api/channels/" + result.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, result.getId()))
            .body(result);
    }

    /**
     * {@code PUT  /channels/:id} : Updates an existing channel.
     *
     * @param id the id of the channel to save.
     * @param channel the channel to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated channel,
     * or with status {@code 400 (Bad Request)} if the channel is not valid,
     * or with status {@code 500 (Internal Server Error)} if the channel couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/channels/{id}")
    public ResponseEntity<Channel> updateChannel(
        @PathVariable(value = "id", required = false) final String id,
        @RequestBody Channel channel
    ) throws URISyntaxException {
        log.debug("REST request to update Channel : {}, {}", id, channel);
        if (channel.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, channel.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!channelRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Channel result = channelRepository.save(channel);
        return ResponseEntity
            .ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, channel.getId()))
            .body(result);
    }

    /**
     * {@code PATCH  /channels/:id} : Partial updates given fields of an existing channel, field will ignore if it is null
     *
     * @param id the id of the channel to save.
     * @param channel the channel to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated channel,
     * or with status {@code 400 (Bad Request)} if the channel is not valid,
     * or with status {@code 404 (Not Found)} if the channel is not found,
     * or with status {@code 500 (Internal Server Error)} if the channel couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/channels/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Channel> partialUpdateChannel(
        @PathVariable(value = "id", required = false) final String id,
        @RequestBody Channel channel
    ) throws URISyntaxException {
        log.debug("REST request to partial update Channel partially : {}, {}", id, channel);
        if (channel.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, channel.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!channelRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Channel> result = channelRepository
            .findById(channel.getId())
            .map(existingChannel -> {
                if (channel.getName() != null) {
                    existingChannel.setName(channel.getName());
                }
                if (channel.getType() != null) {
                    existingChannel.setType(channel.getType());
                }
                if (channel.getModType() != null) {
                    existingChannel.setModType(channel.getModType());
                }
                if (channel.getEmergency() != null) {
                    existingChannel.setEmergency(channel.getEmergency());
                }

                return existingChannel;
            })
            .map(channelRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, channel.getId())
        );
    }

    /**
     * {@code GET  /channels} : get all the channels.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of channels in body.
     */
    @GetMapping("/channels")
    public List<Channel> getAllChannels() {
        log.debug("REST request to get all Channels");
        return channelRepository.findAll();
    }

    /**
     * {@code GET  /channels/:id} : get the "id" channel.
     *
     * @param id the id of the channel to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the channel, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/channels/{id}")
    public ResponseEntity<Channel> getChannel(@PathVariable String id) {
        log.debug("REST request to get Channel : {}", id);
        Optional<Channel> channel = channelRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(channel);
    }

    /**
     * {@code DELETE  /channels/:id} : delete the "id" channel.
     *
     * @param id the id of the channel to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/channels/{id}")
    public ResponseEntity<Void> deleteChannel(@PathVariable String id) {
        log.debug("REST request to delete Channel : {}", id);
        channelRepository.deleteById(id);
        return ResponseEntity.noContent().headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id)).build();
    }
}