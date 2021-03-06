class HTTPClientAdapter < HTTPBaseAdapter
  def send_get_request
    ::HTTPClient.get(parse_uri, header: @headers)
  end

  def send_post_request
    ::HTTPClient.post(parse_uri, body: query_string, header: @headers)
  end

  def send_post_form_request
    ::HTTPClient.post(parse_uri, body: @params, header: @headers)
  end

  def send_multipart_post_request
    send_post_form_request
  end

  def self.response_should_be
    HTTP::Message
  end
end
