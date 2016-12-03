package com.thinkbiganalytics.metadata.modeshape.feed;

import com.thinkbiganalytics.metadata.api.category.Category;
import com.thinkbiganalytics.metadata.api.feed.Feed;
import com.thinkbiganalytics.metadata.api.feed.FeedProvider;
import com.thinkbiganalytics.metadata.api.feedmgr.category.FeedManagerCategory;
import com.thinkbiganalytics.metadata.api.feedmgr.feed.FeedManagerFeed;
import com.thinkbiganalytics.metadata.api.feedmgr.feed.FeedManagerFeedProvider;
import com.thinkbiganalytics.metadata.api.feedmgr.template.FeedManagerTemplate;
import com.thinkbiganalytics.metadata.modeshape.BaseJcrProvider;
import com.thinkbiganalytics.metadata.modeshape.JcrMetadataAccess;
import com.thinkbiganalytics.metadata.modeshape.MetadataRepositoryException;
import com.thinkbiganalytics.metadata.modeshape.common.EntityUtil;
import com.thinkbiganalytics.metadata.modeshape.common.JcrEntity;
import com.thinkbiganalytics.metadata.modeshape.support.JcrQueryUtil;

import java.io.Serializable;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;
import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.jcr.query.QueryResult;

/**
 * Created by sr186054 on 6/8/16.
 */


public class JcrFeedManagerFeedProvider extends BaseJcrProvider<FeedManagerFeed, Feed.ID> implements FeedManagerFeedProvider {

    @Override
    public String getNodeType(Class<? extends JcrEntity> jcrEntityType) {
        return JcrFeed.NODE_TYPE;
    }


    @Override
    public Class<JcrFeedManagerFeed> getEntityClass() {
        return JcrFeedManagerFeed.class;
    }

    @Override
    public Class<? extends JcrEntity> getJcrEntityClass() {
        return JcrFeedManagerFeed.class;
    }

    @Inject
    private FeedProvider feedProvider;


    @Override
    public FeedManagerFeed findBySystemName(String categorySystemName, String systemName) {

            JcrFeed feed = (JcrFeed) feedProvider.findBySystemName(categorySystemName, systemName);
            if (feed != null) {
                if (feed instanceof FeedManagerFeed) {
                    return (FeedManagerFeed) feed;
                } else {
                    return new JcrFeedManagerFeed<>(feed.getNode());
                }
            }
            return null;

    }

    public FeedManagerFeed ensureFeed(Feed feed) {
            FeedManagerFeed fmFeed = findById(feed.getId());
            if (fmFeed == null) {
                JcrFeed jcrFeed = (JcrFeed) feed;
                fmFeed = new JcrFeedManagerFeed(jcrFeed.getNode());
            }
            return fmFeed;

    }

    public FeedManagerFeed ensureFeed(Category.ID categoryId, String feedSystemName) {
        Feed feed = feedProvider.ensureFeed(categoryId, feedSystemName);
        return ensureFeed(feed);
    }



    @Override
    public List<? extends FeedManagerFeed> findByTemplateId(FeedManagerTemplate.ID templateId) {
        String query = "SELECT * from " + EntityUtil.asQueryProperty(JcrFeed.NODE_TYPE) + " as e WHERE e." + EntityUtil.asQueryProperty(JcrFeedManagerFeed.TEMPLATE) + " = $id";
        Map<String, String> bindParams = new HashMap<>();
        bindParams.put("id", templateId.toString());
        return JcrQueryUtil.find(getSession(), query, JcrFeedManagerFeed.class);
    }

    @Override
    public List<? extends FeedManagerFeed> findByCategoryId(FeedManagerCategory.ID categoryId) {

        String query = "SELECT * from " + EntityUtil.asQueryProperty(JcrFeed.NODE_TYPE) + " as e "
                       + "WHERE e." + EntityUtil.asQueryProperty(JcrFeedManagerFeed.CATEGORY) + " = $id";

        Map<String, String> bindParams = new HashMap<>();
        bindParams.put("id", categoryId.toString());

        try {
            QueryResult result = JcrQueryUtil.query(getSession(),query,bindParams);
            return JcrQueryUtil.queryResultToList(result, JcrFeedManagerFeed.class);
        } catch (RepositoryException e) {
            throw new MetadataRepositoryException("Unable to getFeeds for Category ",e);
        }

    }

    public Feed.ID resolveId(Serializable fid) {
        return new JcrFeed.FeedId(fid);
    }

    @Override
    public void delete(FeedManagerFeed feedManagerFeed) {
        // Remove dependent feeds
        final Node node = ((JcrFeedManagerFeed) feedManagerFeed).getNode();
        feedManagerFeed.getDependentFeeds().forEach(feed -> feedManagerFeed.removeDependentFeed((JcrFeed) feed));
        JcrMetadataAccess.getCheckedoutNodes().removeIf(node::equals);

        // Delete feed
        feedManagerFeed.getTemplate().removeFeed(feedManagerFeed);
        super.delete(feedManagerFeed);
    }
}
